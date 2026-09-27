// ---------------------------------------------------------------------------
//  Jewelry Admin — shared helpers
//  Auth (HMAC-signed cookie), GitHub Contents API, Cloudflare KV drafts.
//  Imported by the admin functions. Not a route itself (no onRequest export).
// ---------------------------------------------------------------------------

import type { Env, GhContentItem } from "@/lib/env";

// Backwards-compatible alias: the admin handlers historically import
// `AdminEnv`, whose canonical definition moved to `src/lib/env.ts` when the
// `functions/` directory was retired (see src/lib/env.ts header).
export type AdminEnv = Env;

// IMPORTANT: this is the V1 bootstrap-only cookie name, intentionally distinct
// from the V2 session cookie `jewelry_admin_v2`. Nothing issues this cookie any
// more; `isAuthed()` is kept solely as the F1 fallback in
// `src/lib/admin/rbac.ts` (V1 cookie + V2 API → 401 once an active Owner exists).
const COOKIE = "jewelry_admin";
const SESSION_DAYS = 7;

// ---- Crypto ----------------------------------------------------------------
async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---- Session cookie -------------------------------------------------------
export function newSession(password: string): Promise<string> {
  const payload = String(Date.now());
  return hmac(password, payload).then((sig) => `${sig}.${payload}`);
}

export async function verifySession(token: string | undefined, password: string): Promise<boolean> {
  if (!token) return false;
  const [sig, payload] = token.split(".");
  if (!sig || !payload) return false;
  const expected = await hmac(password, payload);
  // Constant-time comparison to prevent timing attacks
  if (sig.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < sig.length; i++) {
    diff |= sig.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  if (diff !== 0) return false;
  const age = Date.now() - Number(payload);
  return age < SESSION_DAYS * 24 * 3600 * 1000;
}

export function readCookie(request: Request): string | undefined {
  const header = request.headers.get("Cookie");
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return decodeURIComponent(v.join("="));
  }
  return undefined;
}

export function sessionCookie(token: string): string {
  return `${COOKIE}=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${SESSION_DAYS * 24 * 3600}`;
}

export function clearCookie(): string {
  return `${COOKIE}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

export function isAuthed(request: Request, env: AdminEnv): Promise<boolean> {
  const pw = env.ADMIN_PASSWORD || "";
  if (!pw) return Promise.resolve(false);
  return verifySession(readCookie(request), pw);
}

// ---- GitHub Contents API --------------------------------------------------
export function repo(env: AdminEnv): string {
  return env.ADMIN_GITHUB_REPO || "change979666/Jewelry";
}

function ghHeaders(token: string): Record<string, string> {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
    // GitHub rejects requests without a User-Agent; Workers' fetch sends none by default.
    "User-Agent": "Jewelry-CMS",
  };
}

export async function ghGet(path: string, env: AdminEnv): Promise<GhContentItem | null> {
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return null;
  const res = await fetch(`https://api.github.com/repos/${repo(env)}/contents/${path}`, {
    headers: ghHeaders(token),
  });
  if (!res.ok) return null;
  return (await res.json()) as GhContentItem;
}

/**
 * V5.56：可区分「已发布 / 文件不存在 / GitHub 错误」的 ghGet。
 * 查询失败 ≠ 未发布 —— 调用方对 error 必须 fail-safe（跳过），不得当成「未发布」去重新生成。
 */
export async function ghGetChecked(
  path: string,
  env: AdminEnv,
): Promise<{ state: "found" | "missing" | "error"; item: GhContentItem | null; error?: string }> {
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return { state: "error", item: null, error: "ADMIN_GITHUB_TOKEN not configured" };
  let res: Response;
  try {
    res = await fetch(`https://api.github.com/repos/${repo(env)}/contents/${path}`, {
      headers: ghHeaders(token),
    });
  } catch (e) {
    return { state: "error", item: null, error: e instanceof Error ? e.message : String(e) };
  }
  if (res.status === 404) return { state: "missing", item: null };
  if (!res.ok) {
    return { state: "error", item: null, error: `GitHub API ${res.status}` };
  }
  try {
    return { state: "found", item: (await res.json()) as GhContentItem };
  } catch (e) {
    return {
      state: "error",
      item: null,
      error: `Bad JSON from GitHub: ${e instanceof Error ? e.message : String(e)}`,
    };
  }
}

export async function ghPut(
  path: string,
  contentB64: string,
  message: string,
  env: AdminEnv,
  sha?: string,
): Promise<boolean> {
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return false;
  const body: { message: string; content: string; sha?: string } = { message, content: contentB64 };
  if (sha) body.sha = sha;
  const res = await fetch(`https://api.github.com/repos/${repo(env)}/contents/${path}`, {
    method: "PUT",
    headers: ghHeaders(token),
    body: JSON.stringify(body),
  });
  return res.ok;
}

// Delete a file via the Contents API. GitHub requires the current blob sha, so
// we fetch it first. Missing file (no sha) is treated as already-deleted (true).
// V5.67（S23）：GitHub 读取失败 ≠「文件已删除」——error 时返回 false，不静默假装成功。
export async function ghDelete(path: string, message: string, env: AdminEnv): Promise<boolean> {
  const token = env.ADMIN_GITHUB_TOKEN;
  if (!token) return false;
  const existing = await ghGetChecked(path, env);
  if (existing.state === "error") {
    console.error(
      "[ghDelete] cannot confirm file state, refusing to report deleted:",
      existing.error,
    );
    return false;
  }
  if (existing.state === "missing" || !existing.item?.sha) return true; // genuinely already deleted
  const res = await fetch(`https://api.github.com/repos/${repo(env)}/contents/${path}`, {
    method: "DELETE",
    headers: ghHeaders(token),
    body: JSON.stringify({ message, sha: existing.item.sha }),
  });
  return res.ok;
}

// ---- Drafts (KV) ----------------------------------------------------------
// Key format: `draft:${collection}:${key}:${locale}`
// The "draft:" prefix isolates drafts from rate-limit keys (rl:*) and inquiry
// fallback keys (inq:*) in the shared DRAFTS KV namespace.
export function draftKey(collection: string, key: string, locale: string): string {
  return `draft:${collection}:${key}:${locale}`;
}

/**
 * V5.67（S22）：返回 boolean。KV 未绑定或 put 抛错 → false（草稿**未**保存），
 * 调用方必须据此回 503，绝不能丢弃编辑却提示「已保存」。
 */
export async function saveDraft(
  env: AdminEnv,
  collection: string,
  key: string,
  locale: string,
  body: string,
): Promise<boolean> {
  if (!env.DRAFTS) {
    console.error("[draft] DRAFTS KV not bound — draft NOT saved");
    return false;
  }
  try {
    await env.DRAFTS.put(draftKey(collection, key, locale), body);
    return true;
  } catch (e) {
    console.error(
      "[draft] KV put failed — draft NOT saved:",
      e instanceof Error ? e.message : String(e),
    );
    return false;
  }
}

export async function getDraft(
  env: AdminEnv,
  collection: string,
  key: string,
  locale: string,
): Promise<string | null> {
  if (!env.DRAFTS) return null;
  return env.DRAFTS.get(draftKey(collection, key, locale));
}

export async function deleteDraft(
  env: AdminEnv,
  collection: string,
  key: string,
  locale: string,
): Promise<void> {
  if (!env.DRAFTS) return;
  await env.DRAFTS.delete(draftKey(collection, key, locale));
}

export async function listDrafts(env: AdminEnv): Promise<string[]> {
  if (!env.DRAFTS) return [];
  const out: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.DRAFTS.list({ cursor, prefix: "draft:" });
    for (const { name } of page.keys) out.push(name);
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return out;
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export function b64encode(str: string): string {
  // UTF-8 safe base64
  const bytes = new TextEncoder().encode(str);
  let bin = "";
  bytes.forEach((b) => (bin += String.fromCharCode(b)));
  return btoa(bin);
}

export function b64decode(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ""));
  const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
