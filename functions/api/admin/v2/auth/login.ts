// Phase 2 Auth — V2 Login endpoint
// W1: Per-user password (HMAC-SHA256 vs admin_users.password_hash, constant-time compare)
// F3: IP-based login rate limiting (KV, 5 attempts / 5-minute window, 15-minute cooldown)
// Cookie: aromiso_admin_v2 (JWT-style HMAC token with username embedded)

import type { AdminEnv } from "../../../admin/shared";
import { json } from "../../../admin/shared";
import { logAction } from "../../../../lib/admin/audit";
import { parseJsonBody } from "../../../../lib/safe";

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

// ---- V2 Login Handler --------------------------------------------------------

export async function onRequest(context: { request: Request; env: AdminEnv }) {
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
  const cookie = `aromiso_admin_v2=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${7 * 24 * 3600}`;

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
