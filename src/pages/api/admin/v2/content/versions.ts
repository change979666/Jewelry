// Phase 4 — V2 Content Versions (History + Rollback)
// GET: List version history for an entity

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
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
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const permErr = requirePermission(user, "content", "view");
  if (permErr) return permErr;

  const url = new URL(request.url);
  const entityType = url.searchParams.get("entity_type");
  const entityKey = url.searchParams.get("entity_key");
  const locale = url.searchParams.get("locale") || "en";

  if (!entityType || !entityKey)
    return fail("VALIDATION_ERROR", "entity_type and entity_key required", 422);

  const rows = await env.DB.prepare(
    `SELECT * FROM content_versions WHERE entity_type = ? AND entity_key = ? AND locale = ? ORDER BY version DESC LIMIT 50`,
  )
    .bind(entityType, entityKey, locale)
    .all();

  return new Response(
    JSON.stringify({ success: true, data: rows.results ?? [], error: null, meta: null }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
