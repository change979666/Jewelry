// Phase 4 — V2 Recycle Bin (Soft-deleted content recovery)
// GET: List soft-deleted items
// POST: Restore a soft-deleted item

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { logAction } from "@/lib/admin/audit";
import { parseJsonBody } from "@/lib/safe";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  // ---- GET: List recycled items --------------------------------------------
  if (request.method === "GET") {
    const permErr = requirePermission(user, "content", "view");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const entityType = url.searchParams.get("type") || "";

    let query = `SELECT entity_type, entity_id, title, status, updated_at FROM admin_entities WHERE status = 'deleted'`;
    const params: string[] = [];

    if (entityType) {
      query += ` AND entity_type = ?`;
      params.push(entityType);
    }
    query += ` ORDER BY updated_at DESC LIMIT 50`;

    const rows = await env.DB.prepare(query)
      .bind(...params)
      .all();
    return new Response(
      JSON.stringify({ success: true, data: rows.results ?? [], error: null, meta: null }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---- POST: Restore item --------------------------------------------------
  if (request.method === "POST") {
    const permErr = requirePermission(user, "content", "edit");
    if (permErr) return permErr;

    const parsed = await parseJsonBody<{
      entity_type?: string;
      entity_id?: string;
    }>(request);
    if (!parsed.ok) {
      const message =
        parsed.code === "EMPTY_BODY"
          ? "Request body is empty"
          : parsed.code === "INVALID_JSON"
            ? "Invalid JSON body"
            : "Failed to read request body";
      return fail(parsed.code, message, 400);
    }
    const body = parsed.body;
    const { entity_type, entity_id } = body;
    if (!entity_type || !entity_id)
      return fail("VALIDATION_ERROR", "entity_type and entity_id required", 422);

    // Restore in admin_entities
    await env.DB.prepare(
      `UPDATE admin_entities SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE entity_type = ? AND entity_id = ? AND status = 'deleted'`,
    )
      .bind(entity_type, entity_id)
      .run();

    // If it's a commerce product, clear deleted_at
    if (entity_type === "commerce_product") {
      await env.DB.prepare(
        `UPDATE commerce_products SET deleted_at = NULL, deleted_by = NULL WHERE id = ? AND deleted_at IS NOT NULL`,
      )
        .bind(entity_id)
        .run();
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "update",
      resource_type: entity_type,
      resource_id: entity_id,
      change_summary: "Restored from recycle bin",
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: { entity_type, entity_id, status: "active" },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET or POST", 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
