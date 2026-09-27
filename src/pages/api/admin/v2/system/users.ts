// Phase 2 System — V2 Users CRUD (Owner/Admin only)

import { authenticateRequest, checkPermission, type AuthUser } from "@/lib/admin/rbac";
import { logAction } from "@/lib/admin/audit";
import { parseJsonBody } from "@/lib/safe";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function guard(
  user: AuthUser | null,
  action: "view" | "create" | "edit" | "delete",
): Response | null {
  if (!user)
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Login required" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  if (
    !checkPermission(user, "system", "manage_settings") &&
    !checkPermission(user, "system", action)
  ) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }
  return null;
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);

  if (!env.DB) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "INTERNAL_ERROR", message: "Database unavailable" },
        meta: null,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  if (request.method === "GET") {
    const err = guard(user, "view");
    if (err) return err;
    const users = await env.DB.prepare(
      `SELECT u.id, u.username, u.role_id, r.name as role_name, u.status, u.last_login_at, u.created_at
       FROM admin_users u JOIN admin_roles r ON u.role_id = r.id ORDER BY u.created_at DESC`,
    ).all();
    return new Response(
      JSON.stringify({ success: true, data: users.results, error: null, meta: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  if (request.method === "POST") {
    const err = guard(user, "create");
    if (err) return err;
    const parsed = await parseJsonBody<{
      username?: string;
      password?: string;
      role_id?: string;
    }>(request);
    if (!parsed.ok) {
      const message =
        parsed.code === "EMPTY_BODY"
          ? "Request body is empty"
          : parsed.code === "INVALID_JSON"
            ? "Invalid JSON body"
            : "Failed to read request body";
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: parsed.code, message },
          meta: null,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const body = parsed.body;
    if (!body.username || !body.password || !body.role_id) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "username, password, role_id required" },
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    const id = crypto.randomUUID();
    const pw = env.ADMIN_PASSWORD || "";
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(pw),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body.password));
    const hash = [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
    const roleRow = await env.DB.prepare("SELECT id FROM admin_roles WHERE id = ?")
      .bind(body.role_id)
      .first();
    if (!roleRow) {
      return new Response(
        JSON.stringify({
          success: false,
          data: null,
          error: { code: "VALIDATION_ERROR", message: "Invalid role_id" },
          meta: null,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    try {
      await env.DB.prepare(
        "INSERT INTO admin_users (id, username, password_hash, role_id) VALUES (?, ?, ?, ?)",
      )
        .bind(id, body.username, hash, body.role_id)
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE")) {
        return new Response(
          JSON.stringify({
            success: false,
            data: null,
            error: { code: "CONFLICT", message: "Username already exists" },
            meta: null,
          }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      throw e;
    }
    await logAction(env, {
      actor_type: "human",
      user_id: user!.id,
      username: user!.username,
      action: "create",
      resource_type: "system",
      resource_id: id,
      resource_title: body.username,
      change_summary: `Created user ${body.username} as ${body.role_id}`,
    });
    return new Response(
      JSON.stringify({
        success: true,
        data: { id, username: body.username },
        error: null,
        meta: null,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } },
    );
  }

  return new Response(
    JSON.stringify({
      success: false,
      data: null,
      error: { code: "METHOD_NOT_ALLOWED", message: "Use GET or POST" },
      meta: null,
    }),
    { status: 405, headers: { "Content-Type": "application/json", Allow: "GET, POST" } },
  );
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
