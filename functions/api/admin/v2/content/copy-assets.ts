// Phase 4 — V2 Copy Assets CRUD
// GET: List copy assets with filters
// POST: Create or update copy asset

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { logAction } from "../../../../lib/admin/audit";
import { createVersion, nextVersion } from "../../../../lib/admin/versioning";
import { syncAdminEntity } from "../../../../lib/admin/admin-entities";
import { parseJsonBody } from "../../../../lib/safe";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  // ---- GET: List copy assets -----------------------------------------------
  if (request.method === "GET") {
    const permErr = requirePermission(user, "content", "view");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    const locale = url.searchParams.get("locale") || "";
    const linkedType = url.searchParams.get("linked_entity_type") || "";
    const linkedId = url.searchParams.get("linked_entity_id") || "";
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)),
    );

    let query = `SELECT * FROM copy_assets WHERE deleted_at IS NULL`;
    const params: string[] = [];

    if (type) {
      query += ` AND type = ?`;
      params.push(type);
    }
    if (locale) {
      query += ` AND locale = ?`;
      params.push(locale);
    }
    if (linkedType) {
      query += ` AND linked_entity_type = ?`;
      params.push(linkedType);
    }
    if (linkedId) {
      query += ` AND linked_entity_id = ?`;
      params.push(linkedId);
    }
    if (status) {
      query += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      query += ` AND (name LIKE ? OR current_body LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
    const totalRow = await env.DB.prepare(countQuery)
      .bind(...params)
      .first<{ total: number }>();

    query += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(String(pageSize), String((page - 1) * pageSize));

    const rows = await env.DB.prepare(query)
      .bind(...params)
      .all();
    return new Response(
      JSON.stringify({
        success: true,
        data: { items: rows.results ?? [], total: totalRow?.total ?? 0, page, pageSize },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // ---- POST: Create or update copy asset -----------------------------------
  if (request.method === "POST") {
    const permErr = requirePermission(user, "content", "edit");
    if (permErr) return permErr;

    const parsed = await parseJsonBody<{
      id?: string;
      name?: string;
      type?: string;
      locale?: string;
      linked_entity_type?: string;
      linked_entity_id?: string;
      current_body?: string;
      status?: string;
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

    if (body.id) {
      // Update existing
      const existing = await env.DB.prepare(`SELECT * FROM copy_assets WHERE id = ?`)
        .bind(body.id)
        .first<{ id: string; current_body: string }>();
      if (!existing) return fail("NOT_FOUND", "Copy asset not found", 404);

      const fields: string[] = [];
      const values: unknown[] = [];
      for (const [k, v] of Object.entries(body)) {
        if (k === "id" || v === undefined) continue;
        fields.push(`${k} = ?`);
        values.push(v);
      }
      fields.push("updated_at = CURRENT_TIMESTAMP");
      values.push(body.id);

      await env.DB.prepare(`UPDATE copy_assets SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...values)
        .run();

      // Version snapshot
      if (body.current_body && body.current_body !== existing.current_body) {
        const ver = await nextVersion(env, "copy_asset", body.id);
        await createVersion(env, {
          entity_type: "copy_asset",
          entity_key: body.id,
          version: ver,
          author: `human:${user.username}`,
          source: "manual_edit",
        });
      }

      await logAction(env, {
        actor_type: "human",
        user_id: user.id,
        username: user.username,
        action: "update",
        resource_type: "copy_asset",
        resource_id: body.id,
        change_summary: `Updated copy asset: ${body.name ?? body.id}`,
      });

      await syncAdminEntity(env, {
        entity_type: "copy_asset",
        entity_id: body.id,
        title: body.name,
        status: body.status,
      });

      return new Response(
        JSON.stringify({ success: true, data: { id: body.id }, error: null, meta: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Create new
    if (!body.name || !body.type) return fail("VALIDATION_ERROR", "name and type required", 422);

    const id = crypto.randomUUID();
    await env.DB.prepare(
      `INSERT INTO copy_assets (id, name, type, locale, linked_entity_type, linked_entity_id, current_body, status, created_by_source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
      .bind(
        id,
        body.name,
        body.type,
        body.locale ?? "en",
        body.linked_entity_type ?? null,
        body.linked_entity_id ?? null,
        body.current_body ?? "",
        body.status ?? "draft",
        `human:${user.username}`,
      )
      .run();

    // Create initial version
    await createVersion(env, {
      entity_type: "copy_asset",
      entity_key: id,
      version: 1,
      author: `human:${user.username}`,
      source: "manual_edit",
    });

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "create",
      resource_type: "copy_asset",
      resource_id: id,
      change_summary: `Created copy asset: ${body.name}`,
    });

    await syncAdminEntity(env, {
      entity_type: "copy_asset",
      entity_id: id,
      title: body.name,
      status: body.status ?? "draft",
    });

    return new Response(JSON.stringify({ success: true, data: { id }, error: null, meta: null }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // ---- DELETE: Soft delete copy asset --------------------------------------
  if (request.method === "DELETE") {
    const permErr = requirePermission(user, "content", "delete");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const id = url.searchParams.get("id");
    if (!id) return fail("VALIDATION_ERROR", "id required", 422);

    await env.DB.prepare(
      `UPDATE copy_assets SET deleted_at = CURRENT_TIMESTAMP, deleted_by = ? WHERE id = ?`,
    )
      .bind(user.username, id)
      .run();

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "delete",
      resource_type: "copy_asset",
      resource_id: id,
      change_summary: "Soft deleted copy asset",
    });

    return new Response(JSON.stringify({ success: true, data: null, error: null, meta: null }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, or DELETE", 405);
}
