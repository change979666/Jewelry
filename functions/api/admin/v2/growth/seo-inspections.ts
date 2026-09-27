// Phase 8 — V2 SEO Inspections API
// GET    /api/admin/v2/growth/seo-inspections       → list inspections
// GET    /api/admin/v2/growth/seo-inspections?url=x → single URL inspection
// POST   /api/admin/v2/growth/seo-inspections       → create inspection
import type { AdminEnv } from "../../shared";
import { authenticateRequest, checkPermission } from "../../../../lib/admin/rbac";

function ok(data: unknown, meta?: unknown) {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: meta || null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function fail(code: string, message: string, status: number) {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

export async function onRequest(context: { request: Request; env: AdminEnv }): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (!checkPermission(user, "growth", "view"))
    return fail("FORBIDDEN", "Missing permission: growth:view", 403);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const db = env.DB;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET") {
    const targetUrl = url.searchParams.get("url");
    if (targetUrl) {
      const row = await db
        .prepare("SELECT * FROM index_status WHERE url = ?")
        .bind(targetUrl)
        .first();
      if (!row) return fail("NOT_FOUND", "No inspection found for this URL", 404);
      return ok(row);
    }
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
    const pageSize = Math.min(
      100,
      Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)),
    );
    const statusFilter = url.searchParams.get("status") || "";
    const search = url.searchParams.get("search") || "";

    let where = "WHERE 1=1";
    const params: unknown[] = [];
    if (statusFilter) {
      where += " AND status = ?";
      params.push(statusFilter);
    }
    if (search) {
      where += " AND url LIKE ?";
      params.push(`%${search}%`);
    }

    const countRow = await db
      .prepare(`SELECT COUNT(*) as total FROM index_status ${where}`)
      .bind(...params)
      .first();
    const total = (countRow?.total as number) || 0;
    const offset = (page - 1) * pageSize;
    const rows = await db
      .prepare(`SELECT * FROM index_status ${where} ORDER BY inspected_at DESC LIMIT ? OFFSET ?`)
      .bind(...params, pageSize, offset)
      .all();

    return ok(rows.results, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }

  if (method === "POST") {
    if (!checkPermission(user, "growth", "edit"))
      return fail("FORBIDDEN", "Missing permission: growth:edit", 403);
    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("VALIDATION_ERROR", "Invalid JSON", 422);
    }
    const targetUrl = body.url as string;
    if (!targetUrl) return fail("VALIDATION_ERROR", "url is required", 422);

    const status = (body.status as string) || "unknown";
    const detail = (body.detail as string) || "";
    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        `INSERT OR REPLACE INTO index_status (url, status, detail, inspected_at) VALUES (?, ?, ?, ?)`,
      )
      .bind(targetUrl, status, detail, now)
      .run();
    return ok({ url: targetUrl, status, detail, inspected_at: now });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET or POST", 405);
}
