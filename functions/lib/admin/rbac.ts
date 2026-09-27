// Phase 2 RBAC Middleware — server-side permission enforcement
// Roles: Owner, Admin, Editor, Viewer (ADR: 4 roles, scale as needed)
// AI permissions are managed separately by permissions.ts — RBAC governs human users only.

import type { AdminEnv } from "../../api/admin/shared";

export type RoleId = "role_owner" | "role_admin" | "role_editor" | "role_viewer";
export type Resource =
  "content" | "commerce" | "customers" | "oem" | "media" | "ai" | "growth" | "system";
export type Action =
  | "view"
  | "create"
  | "edit"
  | "publish"
  | "delete"
  | "export"
  | "execute_ai"
  | "approve_ai"
  | "manage_settings";

export interface AuthUser {
  id: string;
  username: string;
  role_id: RoleId;
  role_name: string;
  status: "active" | "disabled";
  permissions: Set<string>; // "resource:action" strings for O(1) lookup
}

const DEGRADED_VIEW_RESOURCES: Resource[] = [
  "content",
  "commerce",
  "customers",
  "oem",
  "media",
  "ai",
  "growth",
  "system",
];

/**
 * D1 quota exhaustion must not turn an already authenticated session into a
 * hard outage. This principal is deliberately read-only and is only returned
 * after verifyV2Token succeeded; all mutations remain denied until D1 RBAC is
 * available again.
 */
function degradedReadOnlyUser(username: string): AuthUser {
  return {
    id: `degraded:${username}`,
    username,
    role_id: "role_viewer",
    role_name: "Viewer (D1 quota degraded)",
    status: "active",
    permissions: new Set(DEGRADED_VIEW_RESOURCES.map((resource) => `${resource}:view`)),
  };
}

function isD1QuotaFailure(err: unknown): boolean {
  const message = String(err instanceof Error ? err.message : err).toLowerCase();
  return (
    message.includes("daily row read limit") ||
    (message.includes("d1_error") && message.includes("quota")) ||
    message.includes("exceeded d1")
  );
}

// ---- RBAC: Check Permission --------------------------------------------------

/** Returns true if user has the required permission. Server-side only — UI must not bypass. */
export function checkPermission(
  user: AuthUser | null,
  resource: Resource,
  action: Action,
): boolean {
  if (!user) return false;
  if (user.status !== "active") return false;
  return user.permissions.has(`${resource}:${action}`);
}

/** Require a permission or return 403. Must be awaited in API handlers. */
export function requirePermission(
  user: AuthUser | null,
  resource: Resource,
  action: Action,
): Response | null {
  if (!checkPermission(user, resource, action)) {
    if (!user) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "UNAUTHORIZED", message: "Login required" },
          meta: null,
        }),
        { status: 401, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "FORBIDDEN", message: `Missing permission: ${resource}:${action}` },
        meta: null,
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  return null; // null = no error, proceed
}

// ---- Load User ---------------------------------------------------------------

/** Load user from D1 by username, with full permissions. Returns null if not found. */
export async function loadUser(env: AdminEnv, username: string): Promise<AuthUser | null> {
  if (!env.DB) return null;
  const row = await env.DB.prepare(
    `SELECT u.id, u.username, u.role_id, u.status, r.name as role_name
     FROM admin_users u JOIN admin_roles r ON u.role_id = r.id
     WHERE u.username = ?`,
  )
    .bind(username)
    .first<{
      id: string;
      username: string;
      role_id: string;
      status: string;
      role_name: string;
    }>();
  if (!row) return null;

  // Load permissions
  const perms = await env.DB.prepare(
    `SELECT resource, action FROM admin_permissions WHERE role_id = ?`,
  )
    .bind(row.role_id)
    .all<{ resource: string; action: string }>();

  const permSet = new Set<string>();
  for (const p of perms.results) {
    permSet.add(`${p.resource}:${p.action}`);
  }

  return {
    id: row.id,
    username: row.username,
    role_id: row.role_id as RoleId,
    role_name: row.role_name,
    status: row.status as "active" | "disabled",
    permissions: permSet,
  };
}

// ---- Auth Helper: authenticate request, return user or null ------------------

export async function authenticateRequest(
  request: Request,
  env: AdminEnv,
): Promise<AuthUser | null> {
  // First try V2 RBAC: check for V2 session cookie
  const v2Cookie = request.headers.get("Cookie") || "";
  const v2Match = v2Cookie.match(/jewelry_admin_v2=([^;]+)/);
  if (v2Match) {
    const { verifyV2Token, sha256Hex } = await import("../../api/admin/v2/auth/login");
    // Finding 4: malformed percent-encoding → treat as invalid cookie (not 500).
    let token: string;
    try {
      token = decodeURIComponent(v2Match[1]);
    } catch {
      return null;
    }
    const payload = await verifyV2Token(token, env);
    if (payload) {
      // F2: revocation check — logout blacklists tokens in KV.
      // KV failure policy (owner-approved 2026-08-27): fail-safe — treat token as valid.
      try {
        const revoked = await env.DRAFTS?.get(`revoked_token:${await sha256Hex(token)}`);
        if (revoked) return null;
      } catch (_) {
        /* fail-safe: proceed */
      }
      try {
        return await loadUser(env, payload.username);
      } catch (err) {
        if (!isD1QuotaFailure(err)) throw err;
        console.warn(
          JSON.stringify({
            event: "auth_degraded_read_only",
            username: payload.username,
            reason: "d1_quota_exhausted",
          }),
        );
        return degradedReadOnlyUser(payload.username);
      }
    }
  }

  // F1: V1 cookie fallback — bootstrap only.
  // Once an active Owner exists in admin_users, V1 cookie → V2 API = 401.
  const { isAuthed } = await import("../../api/admin/shared");
  if (await isAuthed(request, env)) {
    if (!env.DB) return null;
    const cnt = await env.DB.prepare(
      "SELECT COUNT(*) AS cnt FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'",
    ).first<{ cnt: number }>();
    if ((cnt?.cnt ?? 0) > 0) return null;

    // BOOTSTRAP state: system:* permissions only, sourced from DB (W4 — never hardcoded).
    const perms = await env.DB.prepare(
      "SELECT resource, action FROM admin_permissions WHERE role_id = 'role_owner' AND resource = 'system'",
    ).all<{ resource: string; action: string }>();
    const permSet = new Set<string>();
    for (const p of perms.results) {
      permSet.add(`${p.resource}:${p.action}`);
    }
    return {
      id: "bootstrap",
      username: "bootstrap",
      role_id: "role_owner",
      role_name: "Owner (Bootstrap)",
      status: "active",
      permissions: permSet,
    };
  }

  return null;
}

/**
 * V5.54: 机器鉴权——Bearer CRON_SECRET（调度器/无头验收使用）。
 * 与自动化端点的 CRON_SECRET 认证一致；用于只读管理端点的机器调用。
 */
export function cronSecretAuthorized(request: Request, env: AdminEnv): boolean {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  return Boolean(env.CRON_SECRET && token && token === env.CRON_SECRET);
}
