// Phase 2 System — V2 Audit Log query (read-only)
// Returns paginated audit log entries.

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, checkPermission } from "../../../../lib/admin/rbac";

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (request.method !== "GET") {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "NOT_FOUND", message: "Method not allowed" },
      }),
      { status: 405, headers: { "Content-Type": "application/json" } },
    );
  }

  const user = await authenticateRequest(request, env);
  if (!user) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "UNAUTHORIZED", message: "Login required" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!checkPermission(user, "system", "view")) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "FORBIDDEN", message: "Insufficient permissions" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
  }

  if (!env.DB) {
    return new Response(
      JSON.stringify({
        success: false,
        data: null,
        error: { code: "INTERNAL_ERROR", message: "Database unavailable" },
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1");
  const pageSize = Math.min(parseInt(url.searchParams.get("pageSize") || "20"), 100);
  const actorType = url.searchParams.get("actor_type") || "";
  const actionFilter = url.searchParams.get("action") || "";

  let where = "WHERE 1=1";
  const params: (string | number)[] = [];
  if (actorType) {
    where += " AND actor_type = ?";
    params.push(actorType);
  }
  if (actionFilter) {
    where += " AND action = ?";
    params.push(actionFilter);
  }

  const offset = (page - 1) * pageSize;

  const total = await env.DB.prepare(`SELECT COUNT(*) as cnt FROM audit_logs ${where}`)
    .bind(...params)
    .first<{ cnt: number }>();
  const rows = await env.DB.prepare(
    `SELECT id, actor_type, username, action, resource_type, resource_title, change_summary, created_at
     FROM audit_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
  )
    .bind(...params, pageSize, offset)
    .all();

  return new Response(
    JSON.stringify({
      success: true,
      data: rows.results,
      error: null,
      meta: {
        page,
        pageSize,
        total: total?.cnt ?? 0,
        totalPages: Math.ceil((total?.cnt ?? 0) / pageSize),
      },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
