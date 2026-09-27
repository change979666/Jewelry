// Phase 3 — Cmd+K entity search endpoint
// GET /api/admin/v2/system/entities/search?q=&limit=20
// Searches admin_entities by title (LIKE), returns matching results
// Requires authentication; results scoped to authenticated user's viewable entity types

import { authenticateRequest } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const url = new URL(request.url);
  const q = (url.searchParams.get("q") || "").trim();
  const limitRaw = Number(url.searchParams.get("limit")) || 20;
  const limit = Math.min(Math.max(limitRaw, 1), 50);
  const entityType = url.searchParams.get("entity_type") || "";

  if (!q) {
    return new Response(
      JSON.stringify({ success: true, data: [], error: null, meta: { q: "", limit } }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  let query =
    "SELECT entity_type, entity_id, title, status, updated_at FROM admin_entities WHERE title LIKE ?";
  const binds: unknown[] = [`%${q}%`];
  if (entityType) {
    query += " AND entity_type = ?";
    binds.push(entityType);
  }
  query += " ORDER BY updated_at DESC LIMIT ?";
  binds.push(limit);

  const rows = await env.DB.prepare(query)
    .bind(...binds)
    .all();

  return new Response(
    JSON.stringify({
      success: true,
      data: rows.results,
      error: null,
      meta: { q, limit, entity_type: entityType },
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
