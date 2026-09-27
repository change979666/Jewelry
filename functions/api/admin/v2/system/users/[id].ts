// Phase 3 — V2 Users per-id endpoint (PUT / DELETE)
// Security: authenticateRequest + requirePermission → service-side before any data change
// role_id validated against admin_roles table
// status restricted to active|disabled
// Last active Owner protection (count matches F1 bootstrap: role_owner AND status='active')
// Anti-escalation: cannot modify higher-role user; cannot self-escalate

import type { AdminEnv } from "../../../shared";
import { json } from "../../../shared";
import { authenticateRequest, checkPermission } from "../../../../../lib/admin/rbac";
import { logAction } from "../../../../../lib/admin/audit";
import { parseJsonBody } from "../../../../../lib/safe";

const VALID_STATUSES = new Set(["active", "disabled"]);
const ROLE_RANK: Record<string, number> = {
  role_owner: 4,
  role_admin: 3,
  role_editor: 2,
  role_viewer: 1,
};

function respond(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code, message },
      meta: null,
    }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: {
  request: Request;
  env: AdminEnv;
  params: { id: string };
}) {
  const { request, env, params } = context;
  const userId = params.id;

  if (!env.DB) return respond("INTERNAL_ERROR", "Database unavailable", 500);

  if (request.method !== "PUT" && request.method !== "DELETE") {
    return respond("METHOD_NOT_ALLOWED", "Use PUT or DELETE", 405);
  }

  const actor = await authenticateRequest(request, env);
  if (!actor) return respond("UNAUTHORIZED", "Login required", 401);

  // Load target user
  const target = await env.DB.prepare(
    "SELECT id, username, role_id, status FROM admin_users WHERE id = ?",
  )
    .bind(userId)
    .first<{ id: string; username: string; role_id: string; status: string }>();
  if (!target) return respond("NOT_FOUND", "User not found", 404);

  // ── DELETE ──────────────────────────────────────────────────────────
  if (request.method === "DELETE") {
    if (
      !checkPermission(actor, "system", "delete") &&
      !checkPermission(actor, "system", "manage_settings")
    ) {
      return respond("FORBIDDEN", "Missing permission: system:delete", 403);
    }
    // Last active owner protection
    if (target.role_id === "role_owner" && target.status === "active") {
      const cnt = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'",
      ).first<{ c: number }>();
      if ((cnt?.c ?? 0) <= 1)
        return respond("FORBIDDEN", "Cannot delete the last active Owner", 403);
    }
    await env.DB.prepare("DELETE FROM admin_users WHERE id = ?").bind(userId).run();
    await logAction(env, {
      actor_type: "human",
      user_id: actor.id,
      username: actor.username,
      action: "delete",
      resource_type: "system",
      resource_id: userId,
      resource_title: target.username,
      change_summary: `Deleted user ${target.username}`,
    });
    return json({ success: true, data: { id: userId }, error: null, meta: null });
  }

  // ── PUT ─────────────────────────────────────────────────────────────
  if (
    !checkPermission(actor, "system", "edit") &&
    !checkPermission(actor, "system", "manage_settings")
  ) {
    return respond("FORBIDDEN", "Missing permission: system:edit", 403);
  }

  const parsed = await parseJsonBody<{
    role_id?: string;
    status?: string;
    password?: string;
  }>(request);
  if (!parsed.ok) {
    const message =
      parsed.code === "EMPTY_BODY"
        ? "Request body is empty"
        : parsed.code === "INVALID_JSON"
          ? "Invalid JSON body"
          : "Failed to read request body";
    return respond(parsed.code, message, 400);
  }
  const body = parsed.body;

  const changes: string[] = [];

  // Anti-escalation: cannot modify higher-rank user
  const actorRank = ROLE_RANK[actor.role_id] ?? 0;
  const targetRank = ROLE_RANK[target.role_id] ?? 0;
  if (actorRank < targetRank) {
    return respond("FORBIDDEN", "Cannot modify a user with a higher role", 403);
  }

  // ── Role change ─────────────────────────────────────────────────────
  if (body.role_id !== undefined) {
    // Validate role_id exists in admin_roles
    const roleRow = await env.DB.prepare("SELECT id FROM admin_roles WHERE id = ?")
      .bind(body.role_id)
      .first();
    if (!roleRow) return respond("VALIDATION_ERROR", "Invalid role_id", 422);

    // Self-escalation check
    if (userId === actor.id && (ROLE_RANK[body.role_id] ?? 0) > actorRank) {
      return respond("FORBIDDEN", "Cannot self-escalate", 403);
    }

    // Last active owner: demoting last active owner
    if (
      target.role_id === "role_owner" &&
      target.status === "active" &&
      body.role_id !== "role_owner"
    ) {
      const cnt = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'",
      ).first<{ c: number }>();
      if ((cnt?.c ?? 0) <= 1)
        return respond("FORBIDDEN", "Cannot demote the last active Owner", 403);
    }

    await env.DB.prepare(
      "UPDATE admin_users SET role_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(body.role_id, userId)
      .run();
    changes.push(`role -> ${body.role_id}`);
  }

  // ── Status change ───────────────────────────────────────────────────
  if (body.status !== undefined) {
    if (!VALID_STATUSES.has(body.status)) {
      return respond("VALIDATION_ERROR", "Invalid status. Allowed: active, disabled", 422);
    }
    // Last active owner: disabling
    if (
      target.role_id === "role_owner" &&
      target.status === "active" &&
      body.status === "disabled"
    ) {
      const cnt = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM admin_users WHERE role_id = 'role_owner' AND status = 'active'",
      ).first<{ c: number }>();
      if ((cnt?.c ?? 0) <= 1)
        return respond("FORBIDDEN", "Cannot disable the last active Owner", 403);
    }

    await env.DB.prepare(
      "UPDATE admin_users SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(body.status, userId)
      .run();
    changes.push(`status -> ${body.status}`);
  }

  // ── Password change ─────────────────────────────────────────────────
  if (body.password !== undefined) {
    if (!body.password || body.password.length < 1) {
      return respond("VALIDATION_ERROR", "Password required", 422);
    }
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(env.ADMIN_PASSWORD || ""),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body.password));
    const hash = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare(
      "UPDATE admin_users SET password_hash = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
    )
      .bind(hash, userId)
      .run();
    changes.push("password changed");
  }

  if (changes.length === 0) {
    return respond("VALIDATION_ERROR", "Provide role_id, status, or password to update", 422);
  }

  await logAction(env, {
    actor_type: "human",
    user_id: actor.id,
    username: actor.username,
    action: "update",
    resource_type: "system",
    resource_id: userId,
    resource_title: target.username,
    change_summary: `Updated user ${target.username}: ${changes.join(", ")}`,
  });

  return json({ success: true, data: { id: userId }, error: null, meta: null });
}
