// Phase 11 — Roles & Permissions Management API
// GET    — list roles with permissions / list permissions for a role
// POST   — create role
// PUT    — update role / update permissions for a role
// DELETE — delete role (only non-system roles)

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { logAction } from "../../../../lib/admin/audit";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function ok(data: unknown, meta?: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: meta ?? null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function str(v: unknown, max = 100): string {
  return typeof v === "string" ? v.slice(0, max).trim() : "";
}

const SYSTEM_ROLES = ["role_owner", "role_admin", "role_editor", "role_viewer"];
const VALID_RESOURCES = [
  "content",
  "commerce",
  "customers",
  "oem",
  "media",
  "ai",
  "growth",
  "system",
];
const VALID_ACTIONS = [
  "view",
  "create",
  "edit",
  "publish",
  "delete",
  "export",
  "execute_ai",
  "approve_ai",
  "manage_settings",
];

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const url = new URL(request.url);

  // GET
  if (request.method === "GET") {
    const permErr = requirePermission(user, "system", "view");
    if (permErr) return permErr;

    const roleId = url.searchParams.get("role_id") || "";

    if (roleId) {
      // Get single role with permissions
      const role = await env.DB.prepare("SELECT * FROM admin_roles WHERE id = ?")
        .bind(roleId)
        .first();
      if (!role) return fail("NOT_FOUND", "Role not found", 404);

      const perms = await env.DB.prepare(
        "SELECT resource, action FROM admin_permissions WHERE role_id = ? ORDER BY resource, action",
      )
        .bind(roleId)
        .all();
      const userCount = await env.DB.prepare(
        "SELECT COUNT(*) as cnt FROM admin_users WHERE role_id = ?",
      )
        .bind(roleId)
        .first<{ cnt: number }>();

      return ok({ ...role, permissions: perms.results, user_count: userCount?.cnt ?? 0 });
    }

    // List all roles with permission counts
    const roles = await env.DB.prepare(
      `SELECT r.*, (SELECT COUNT(*) FROM admin_permissions WHERE role_id = r.id) as permission_count, (SELECT COUNT(*) FROM admin_users WHERE role_id = r.id) as user_count FROM admin_roles r ORDER BY r.created_at`,
    ).all();

    return ok(roles.results);
  }

  // POST — create role
  if (request.method === "POST") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const name = str(body.name, 50);
    const description = str(body.description, 200);
    if (!name) return fail("VALIDATION_ERROR", "name required", 422);

    const id = `role_${name
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_")
      .slice(0, 30)}`;

    try {
      await env.DB.prepare("INSERT INTO admin_roles (id, name, description) VALUES (?, ?, ?)")
        .bind(id, name, description)
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE")) return fail("CONFLICT", "Role name already exists", 409);
      throw e;
    }

    // If permissions provided, add them
    const permissions = body.permissions as Array<{ resource: string; action: string }> | undefined;
    if (Array.isArray(permissions)) {
      for (const p of permissions) {
        if (VALID_RESOURCES.includes(p.resource) && VALID_ACTIONS.includes(p.action)) {
          await env.DB.prepare(
            "INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)",
          )
            .bind(`perm_${id}_${p.resource}_${p.action}`, id, p.resource, p.action)
            .run();
        }
      }
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "create",
      resource_type: "system",
      resource_id: id,
      resource_title: name,
      change_summary: `Created role: ${name}`,
    });

    return ok({ id, name });
  }

  // PUT — update role or permissions
  if (request.method === "PUT") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const roleId = str(body.role_id, 64);
    if (!roleId) return fail("VALIDATION_ERROR", "role_id required", 422);
    if (SYSTEM_ROLES.includes(roleId) && roleId === "role_owner")
      return fail("FORBIDDEN", "Cannot modify Owner role", 403);

    // Update role name/description
    if (body.name !== undefined || body.description !== undefined) {
      const fields: string[] = [];
      const vals: unknown[] = [];
      if (body.name !== undefined) {
        fields.push("name = ?");
        vals.push(str(body.name, 50));
      }
      if (body.description !== undefined) {
        fields.push("description = ?");
        vals.push(str(body.description, 200));
      }
      if (fields.length > 0) {
        vals.push(roleId);
        await env.DB.prepare(`UPDATE admin_roles SET ${fields.join(", ")} WHERE id = ?`)
          .bind(...vals)
          .run();
      }
    }

    // Update permissions (full replace)
    const permissions = body.permissions as Array<{ resource: string; action: string }> | undefined;
    if (Array.isArray(permissions)) {
      await env.DB.prepare("DELETE FROM admin_permissions WHERE role_id = ?").bind(roleId).run();
      for (const p of permissions) {
        if (VALID_RESOURCES.includes(p.resource) && VALID_ACTIONS.includes(p.action)) {
          await env.DB.prepare(
            "INSERT OR IGNORE INTO admin_permissions (id, role_id, resource, action) VALUES (?, ?, ?, ?)",
          )
            .bind(`perm_${roleId}_${p.resource}_${p.action}`, roleId, p.resource, p.action)
            .run();
        }
      }
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "update",
      resource_type: "system",
      resource_id: roleId,
      resource_title: str(body.name, 50),
      change_summary: `Updated role ${roleId}`,
    });

    return ok({ role_id: roleId, updated: true });
  }

  // DELETE — delete role
  if (request.method === "DELETE") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    const roleId = url.searchParams.get("role_id") || "";
    if (!roleId) return fail("VALIDATION_ERROR", "role_id required", 422);
    if (SYSTEM_ROLES.includes(roleId)) return fail("FORBIDDEN", "Cannot delete system roles", 403);

    // Check if role has users
    const userCount = await env.DB.prepare(
      "SELECT COUNT(*) as cnt FROM admin_users WHERE role_id = ?",
    )
      .bind(roleId)
      .first<{ cnt: number }>();
    if ((userCount?.cnt ?? 0) > 0)
      return fail("CONFLICT", "Cannot delete role with assigned users", 409);

    await env.DB.prepare("DELETE FROM admin_permissions WHERE role_id = ?").bind(roleId).run();
    const result = await env.DB.prepare("DELETE FROM admin_roles WHERE id = ?").bind(roleId).run();
    if (result.meta.changes === 0) return fail("NOT_FOUND", "Role not found", 404);

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "delete",
      resource_type: "system",
      resource_id: roleId,
      change_summary: `Deleted role ${roleId}`,
    });

    return ok({ role_id: roleId, deleted: true });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, PUT, or DELETE", 405);
}
