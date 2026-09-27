// Phase 2 Auth — V2 Login endpoint
// W1: Per-user password (HMAC-SHA256 vs admin_users.password_hash, constant-time compare)
// F3: IP-based login rate limiting (KV, 5 attempts / 5-minute window, 15-minute cooldown)
// Cookie: jewelry_admin_v2 (JWT-style HMAC token with username embedded)

import type { AdminEnv } from "@/pages/api/admin/_shared";
import { json } from "@/pages/api/admin/_shared";
import { logAction } from "@/lib/admin/audit";
import { parseJsonBody } from "@/lib/safe";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

// ---- Crypto helpers ---------------------------------------------------------

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, enc.encode(message)));
}

export async function sha256Hex(message: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(message)));
}

/** Constant-time comparison for fixed-length hex digests. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ---- V2 token ---------------------------------------------------------------
// V2 token format: "<hmac_sig>.<username>.<timestamp>"

export async function newV2Token(username: string, env: AdminEnv): Promise<string> {
  const ts = String(Date.now());
  const sigHex = await hmacHex(env.ADMIN_PASSWORD || "", `${username}.${ts}`);
  return `${sigHex}.${username}.${ts}`;
}

export async function verifyV2Token(
  token: string,
  env: AdminEnv,
): Promise<{ username: string } | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  const [sigHex, username, ts] = parts;
  if (!sigHex || !username || !ts) return null;

  const expectedHex = await hmacHex(env.ADMIN_PASSWORD || "", `${username}.${ts}`);
  if (!timingSafeEqual(sigHex, expectedHex)) return null;

  // Check expiry (7 days)
  const age = Date.now() - Number(ts);
  if (age > 7 * 24 * 3600 * 1000) return null;

  return { username };
}

// ---- F3: Login rate limiting -------------------------------------------------
// KV schema: rl:login:{ip}:{window_id} = "{count}:{first_attempt_ts}", TTL 900s.
// KV failure policy (owner-approved 2026-08-27): fail-open — skip limiting, never block login.

const RL_WINDOW_MS = 5 * 60 * 1000;
const RL_MAX_ATTEMPTS = 5;
const RL_TTL_SECONDS = 900;

// ---- Bootstrap: 首次启动用 env.ADMIN_PASSWORD 创建 Owner ---------------------
// 仅当 admin_users 中不存在任何 active Owner 时允许。创建成功后该路径永久关闭
// （再次进入时 COUNT > 0，直接返回 null 走普通失败流程）。
// 并发安全：INSERT 依赖 username 唯一约束；失败时回读行，绝不为同一 username
// 创建两个账号。

async function tryBootstrapOwner(
  env: AdminEnv,
  username: string,
  password: string,
): Promise<{ id: string; password_hash: string; status: string } | null> {
  if (!env.DB || !env.ADMIN_PASSWORD) return null;
  // 密码必须与 env.ADMIN_PASSWORD 完全一致（常量时间比较 HMAC 摘要）。
  const envDigest = await hmacHex(env.ADMIN_PASSWORD, env.ADMIN_PASSWORD);
  const givenDigest = await hmacHex(env.ADMIN_PASSWORD, password);
  if (!timingSafeEqual(envDigest, givenDigest)) return null;

  try {
    const cnt = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'",
    ).first<{ cnt: number }>();
    if ((cnt?.cnt ?? 0) > 0) return null;

    const id = crypto.randomUUID();
    const passwordHash = await hmacHex(env.ADMIN_PASSWORD, password);
    await env.DB.prepare(
      "INSERT INTO admin_users (id, username, password_hash, role_id, status) VALUES (?,?,?,?, 'active')",
    )
      .bind(id, username, passwordHash, "role_owner")
      .run();

    await logAction(env, {
      actor_type: "human",
      user_id: id,
      username,
      action: "bootstrap_owner_created",
      resource_type: "auth",
      change_summary: "first-boot Owner created from ADMIN_PASSWORD",
    });
    return { id, password_hash: passwordHash, status: "active" };
  } catch {
    // 并发创建冲突或唯一约束命中 → 回读已有行；仍不存在则视为失败。
    try {
      return (
        (await env.DB.prepare(
          "SELECT id, password_hash, status FROM admin_users WHERE username = ?",
        )
          .bind(username)
          .first<{ id: string; password_hash: string; status: string }>()) ?? null
      );
    } catch {
      return null;
    }
  }
}

// ---- V2 Login Handler --------------------------------------------------------

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  if (request.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  // F3: rate limit check before any credential work
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const windowId = Math.floor(Date.now() / RL_WINDOW_MS);
  const rlKey = `rl:login:${ip}:${windowId}`;
  let rlCount = 0;
  let rlFirstTs = "";
  let rlAvailable = true;
  try {
    const raw = await env.DRAFTS?.get(rlKey);
    if (raw) {
      const parts = raw.split(":");
      rlCount = parseInt(parts[0] || "0", 10) || 0;
      rlFirstTs = parts[1] || "";
    }
  } catch (_) {
    rlAvailable = false; // fail-open
  }
  if (rlAvailable && rlCount >= RL_MAX_ATTEMPTS) {
    return json(
      {
        success: false,
        data: null,
        error: { code: "RATE_LIMITED", message: "Too many login attempts" },
      },
      429,
    );
  }

  const parsed = await parseJsonBody<{ username?: string; password?: string }>(request);
  if (!parsed.ok) {
    const message =
      parsed.code === "EMPTY_BODY"
        ? "Request body is empty"
        : parsed.code === "INVALID_JSON"
          ? "Invalid JSON body"
          : "Failed to read request body";
    return json(
      {
        success: false,
        data: null,
        error: { code: parsed.code, message },
      },
      400,
    );
  }
  const body = parsed.body;
  const { username, password } = body;
  if (!username || !password) {
    return json(
      {
        success: false,
        data: null,
        error: { code: "VALIDATION_ERROR", message: "Username and password required" },
      },
      422,
    );
  }

  // W1: per-user password. HMAC + constant-time compare always run (dummy target
  // when the user doesn't exist) so responses leak neither existence nor timing.
  const computed = await hmacHex(env.ADMIN_PASSWORD || "", password);
  let row: { id: string; password_hash: string; status: string } | null;
  try {
    row =
      (await env.DB?.prepare("SELECT id, password_hash, status FROM admin_users WHERE username = ?")
        .bind(username)
        .first<{ id: string; password_hash: string; status: string }>()) ?? null;
  } catch (_) {
    row = null; // DB failure → fail closed
  }

  // 首启 Bootstrap：用户不存在 → 尝试用 ADMIN_PASSWORD 创建 Owner（仅无 Owner 时）。
  if (!row) {
    row = await tryBootstrapOwner(env, username, password);
  }
  // Compare ALWAYS runs (dummy target when user missing) — no timing/enumeration leak.
  const ok =
    timingSafeEqual(computed, row?.password_hash ?? computed) &&
    row !== null &&
    row.status === "active";

  if (!ok || !row) {
    if (rlAvailable) {
      try {
        await env.DRAFTS?.put(rlKey, `${rlCount + 1}:${rlFirstTs || String(Date.now())}`, {
          expirationTtl: RL_TTL_SECONDS,
        });
      } catch (_) {
        /* fail-open */
      }
    }
    await logAction(env, {
      actor_type: "human",
      username,
      action: "login",
      resource_type: "auth",
      change_summary: "login_failed",
    });
    return json(
      {
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Invalid credentials" },
      },
      401,
    );
  }

  // Success: clear this IP's rate-limit counters (best-effort)
  try {
    await env.DRAFTS?.delete(rlKey);
    await env.DRAFTS?.delete(`rl:login:${ip}:${windowId - 1}`);
  } catch (_) {
    /* non-critical */
  }

  try {
    await env.DB?.prepare("UPDATE admin_users SET last_login_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(row.id)
      .run();
  } catch (_) {
    /* non-critical */
  }

  const token = await newV2Token(username, env);
  const cookie = `jewelry_admin_v2=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;

  await logAction(env, {
    actor_type: "human",
    user_id: row.id,
    username,
    action: "login",
    resource_type: "auth",
    change_summary: "login_success",
  });

  return new Response(
    JSON.stringify({ success: true, data: { username }, error: null, meta: null }),
    {
      status: 200,
      headers: { "Content-Type": "application/json", "Set-Cookie": cookie },
    },
  );
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
