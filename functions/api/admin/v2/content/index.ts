// Phase 4 — V2 Content List (Unified DataTable)
// Supports: search, filter, sort, pagination across 5 content types.
// Lazy-checks building publish records on read.

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { lazyCheckBuildingRecords } from "../../../../lib/admin/content-publisher";

type EntityType = "blog" | "product_content" | "guide" | "case_study" | "category_faqs";

interface ContentListItem {
  entity_type: EntityType;
  entity_key: string;
  locale: string;
  title: string;
  excerpt: string;
  status: string;
  publish_status: string | null;
  publish_locale: string | null;
  updated_at: string;
  category: string;
}

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function _collectionToEntity(coll: string): EntityType {
  switch (coll) {
    case "blog":
      return "blog";
    case "products":
      return "product_content";
    case "guides":
      return "guide";
    case "caseStudies":
      return "case_study";
    default:
      return "blog";
  }
}

function _collectionPath(coll: string): string {
  switch (coll) {
    case "blog":
      return "blog";
    case "products":
      return "products";
    case "guides":
      return "guides";
    case "caseStudies":
      return "caseStudies";
    default:
      return coll;
  }
}

// Parse frontmatter from raw MD content
function _parseFrontmatter(raw: string): Record<string, string> {
  const m = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return {};
  const fm: Record<string, string> = {};
  for (const line of m[1].split(/\r?\n/)) {
    const idx = line.indexOf(":");
    if (idx > 0) fm[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return fm;
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const permErr = requirePermission(user, "content", "view");
  if (permErr) return permErr;

  const url = new URL(request.url);
  const entityType = url.searchParams.get("type") as EntityType | null;
  const search = url.searchParams.get("search")?.toLowerCase() || "";
  const statusFilter = url.searchParams.get("status") || "";
  const localeFilter = url.searchParams.get("locale") || "";
  const sortField = url.searchParams.get("sort") || "updated_at";
  const sortOrder = url.searchParams.get("order") || "desc";
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const pageSize = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("pageSize") || "20", 10)),
  );

  // Lazy check building records
  await lazyCheckBuildingRecords(env);

  // Determine which entity types to query
  const entityTypes: EntityType[] = entityType
    ? [entityType]
    : ["blog", "product_content", "guide", "case_study", "category_faqs"];

  // Read content from admin_entities + content_publishments
  const publishLocaleClause = localeFilter ? "WHERE locale = ?" : "";
  let query = `
    SELECT
      ae.entity_type, ae.entity_id, ae.title, ae.status, ae.updated_at,
      cp.status as publish_status, cp.locale as publish_locale
    FROM admin_entities ae
    LEFT JOIN (
      SELECT entity_type, entity_key, locale, status,
             ROW_NUMBER() OVER (PARTITION BY entity_type, entity_key, locale ORDER BY created_at DESC) as rn
       FROM content_publishments
       ${publishLocaleClause}
    ) cp ON cp.entity_type = ae.entity_type AND cp.entity_key = ae.entity_id AND cp.rn = 1
    WHERE ae.entity_type IN (${entityTypes.map(() => "?").join(",")})
  `;
  const params: string[] = localeFilter ? [localeFilter, ...entityTypes] : [...entityTypes];

  if (search) {
    query += ` AND LOWER(ae.title) LIKE ?`;
    params.push(`%${search}%`);
  }
  if (statusFilter) {
    query += ` AND (ae.status = ? OR cp.status = ?)`;
    params.push(statusFilter, statusFilter);
  }
  // admin_entities is locale-neutral. Missing publish records represent the
  // default English draft; published records carry their own locale.
  if (localeFilter) {
    query += ` AND (cp.locale = ? OR (cp.locale IS NULL AND ? = 'en'))`;
    params.push(localeFilter, localeFilter);
  }

  // Count total
  const countQuery = `SELECT COUNT(*) as total FROM (${query})`;
  const totalRow = await env.DB.prepare(countQuery)
    .bind(...params)
    .first<{ total: number }>();
  const total = totalRow?.total ?? 0;

  // Sort
  const validSorts = ["updated_at", "title", "entity_type", "status"];
  const sortCol = validSorts.includes(sortField) ? sortField : "updated_at";
  const order = sortOrder === "asc" ? "ASC" : "DESC";
  query += ` ORDER BY ae.${sortCol} ${order} LIMIT ? OFFSET ?`;
  params.push(String(pageSize), String((page - 1) * pageSize));

  const rows = await env.DB.prepare(query)
    .bind(...params)
    .all<{
      entity_type: string;
      entity_id: string;
      title: string;
      status: string;
      updated_at: string;
      publish_status: string | null;
      publish_locale: string | null;
    }>();

  const items: ContentListItem[] = (rows.results ?? []).map((r) => ({
    entity_type: r.entity_type as EntityType,
    entity_key: r.entity_id,
    locale: r.publish_locale || "en",
    title: r.title || r.entity_id,
    excerpt: "",
    status: r.status,
    publish_status: r.publish_status,
    publish_locale: r.publish_locale || null,
    updated_at: r.updated_at,
    category: r.entity_type,
  }));

  return new Response(
    JSON.stringify({
      success: true,
      data: { items, total, page, pageSize, pages: Math.ceil(total / pageSize) },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
