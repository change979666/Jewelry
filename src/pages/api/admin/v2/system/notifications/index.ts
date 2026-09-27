// Phase 10 — Notifications API (consolidated)
// GET  /api/admin/v2/system/notifications                      — list (filters: type, is_read, page, pageSize)
// GET  /api/admin/v2/system/notifications?action=unread-count  — get unread count
// POST /api/admin/v2/system/notifications                      — create notification
// PUT  /api/admin/v2/system/notifications                      — mark all as read
// PUT  /api/admin/v2/system/notifications?id=xxx               — mark one as read

import { authenticateRequest } from "@/lib/admin/rbac";
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
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const url = new URL(request.url);
  const action = url.searchParams.get("action") || "";

  // GET
  if (request.method === "GET") {
    // ?action=unread-count
    if (action === "unread-count") {
      const row = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM notifications WHERE is_read = 0",
      ).first();
      const count = row ? Number((row as Record<string, unknown>).count) || 0 : 0;
      return new Response(
        JSON.stringify({ success: true, data: { count }, error: null, meta: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    // Default: list notifications
    const type = url.searchParams.get("type") || "";
    const isRead = url.searchParams.get("is_read");
    const page = Math.max(parseInt(url.searchParams.get("page") || "1"), 1);
    const pageSize = Math.min(Math.max(parseInt(url.searchParams.get("pageSize") || "20"), 1), 100);
    const offset = (page - 1) * pageSize;

    let where = "WHERE 1=1";
    const binds: unknown[] = [];
    if (type) {
      where += " AND type = ?";
      binds.push(type);
    }
    if (isRead === "0" || isRead === "1") {
      where += " AND is_read = ?";
      binds.push(parseInt(isRead));
    }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM notifications ${where}`)
      .bind(...binds)
      .first();
    const total = countRow ? Number((countRow as Record<string, unknown>).total) || 0 : 0;

    const rows = await env.DB.prepare(
      `SELECT id, type, title, body, link, entity_type, entity_id, is_read, created_at, read_at
       FROM notifications ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, pageSize, offset)
      .all();

    return new Response(
      JSON.stringify({
        success: true,
        data: rows.results,
        error: null,
        meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  // POST — create notification
  if (request.method === "POST") {
    const parsed = await parseJsonBody<{
      type?: string;
      title?: string;
      body?: string;
      link?: string;
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
    if (!body.type || !body.title) return fail("VALIDATION_ERROR", "type and title required", 422);

    const id = crypto.randomUUID().replace(/-/g, "").slice(0, 16);
    await env.DB.prepare(
      "INSERT INTO notifications (id, type, title, body, link, entity_type, entity_id) VALUES (?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        id,
        body.type,
        body.title,
        body.body || "",
        body.link || "",
        body.entity_type || "",
        body.entity_id || "",
      )
      .run();

    return new Response(JSON.stringify({ success: true, data: { id }, error: null, meta: null }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }

  // PUT — mark as read
  if (request.method === "PUT") {
    const id = url.searchParams.get("id");
    if (id) {
      // Mark one notification as read
      const result = await env.DB.prepare(
        "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE id = ? AND is_read = 0",
      )
        .bind(id)
        .run();
      if (result.meta.changes === 0)
        return fail("NOT_FOUND", "Notification not found or already read", 404);
      return new Response(
        JSON.stringify({ success: true, data: { id, is_read: 1 }, error: null, meta: null }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Mark all as read
    const result = await env.DB.prepare(
      "UPDATE notifications SET is_read = 1, read_at = CURRENT_TIMESTAMP WHERE is_read = 0",
    ).run();
    return new Response(
      JSON.stringify({
        success: true,
        data: { updated: result.meta.changes },
        error: null,
        meta: null,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, or PUT", 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
