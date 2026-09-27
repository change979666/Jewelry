// Phase 9 — V2 Media Center API
// GET  — list media assets (search, filter, sort, pagination)
// POST — create / link / unlink / soft_delete / restore / bulk_delete

import type { AdminEnv } from "@/pages/api/admin/_shared";
import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

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

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 8)}`;
}

function now(): string {
  return new Date().toISOString();
}

function str(v: unknown, max = 2000): string {
  return typeof v === "string" ? v.slice(0, max).trim() : "";
}

function num(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
}

const VALID_MEDIA_TYPES = ["image", "video", "document", "cover", "other"] as const;
const VALID_SOURCES = ["upload", "import", "url", "video_center"] as const;

// ---- GET: list media assets -------------------------------------------------

async function handleGet(request: Request, env: AdminEnv): Promise<Response> {
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  const permErr = requirePermission(user, "media", "view");
  if (permErr) return permErr;

  const db = env.DB!;
  const url = new URL(request.url);
  const sp = url.searchParams;

  // Pagination
  const page = Math.max(1, parseInt(sp.get("page") || "1", 10));
  const pageSize = Math.min(100, Math.max(1, parseInt(sp.get("pageSize") || "24", 10)));
  const offset = (page - 1) * pageSize;

  // Build WHERE clauses
  const conditions: string[] = ["deleted_at = ''"];
  const binds: unknown[] = [];

  const mediaType = str(sp.get("media_type"), 16);
  if (mediaType && (VALID_MEDIA_TYPES as readonly string[]).includes(mediaType)) {
    conditions.push("media_type = ?");
    binds.push(mediaType);
  }

  const source = str(sp.get("source"), 16);
  if (source && (VALID_SOURCES as readonly string[]).includes(source)) {
    conditions.push("source = ?");
    binds.push(source);
  }

  const search = str(sp.get("search"), 200);
  if (search) {
    conditions.push("(title LIKE ? OR filename LIKE ? OR alt_text LIKE ? OR description LIKE ?)");
    const q = `%${search}%`;
    binds.push(q, q, q, q);
  }

  const featured = sp.get("featured");
  if (featured === "1") {
    conditions.push("featured = 1");
  }

  const linked = str(sp.get("linked_type"), 32);
  if (linked) {
    conditions.push("linked_entity_type = ?");
    binds.push(linked);
    const linkedId = str(sp.get("linked_id"), 64);
    if (linkedId) {
      conditions.push("linked_entity_id = ?");
      binds.push(linkedId);
    }
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

  // Sort
  const sortField = sp.get("sort");
  const sortDir = sp.get("dir") === "asc" ? "ASC" : "DESC";
  const allowedSorts = ["created_at", "updated_at", "filename", "file_size", "sort_order", "title"];
  const orderBy = allowedSorts.includes(sortField || "") ? sortField! : "created_at";

  // Count
  const countRow = await db
    .prepare(`SELECT COUNT(*) as total FROM media_assets ${where}`)
    .bind(...binds)
    .first<{ total: number }>();
  const total = countRow?.total ?? 0;

  // Fetch page
  const rows = await db
    .prepare(`SELECT * FROM media_assets ${where} ORDER BY ${orderBy} ${sortDir} LIMIT ? OFFSET ?`)
    .bind(...binds, pageSize, offset)
    .all<Record<string, unknown>>();

  // Fetch links for these assets
  const ids = rows.results.map((r) => String(r.id));
  const linksByMedia: Record<string, Record<string, unknown>[]> = {};
  if (ids.length > 0) {
    const placeholders = ids.map(() => "?").join(",");
    const links = await db
      .prepare(
        `SELECT * FROM media_links WHERE media_id IN (${placeholders}) ORDER BY sort_order ASC`,
      )
      .bind(...ids)
      .all<Record<string, unknown>>();
    for (const l of links.results) {
      const mid = String(l.media_id);
      (linksByMedia[mid] ||= []).push(l);
    }
  }

  const items = rows.results.map((r) => ({
    ...r,
    tags: (() => {
      try {
        return JSON.parse(String(r.tags_json || "[]"));
      } catch {
        return [];
      }
    })(),
    links: linksByMedia[String(r.id)] ?? [],
  }));

  return ok(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
}

// ---- POST: action router ----------------------------------------------------

async function handlePost(request: Request, env: AdminEnv): Promise<Response> {
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const db = env.DB!;
  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return fail("INVALID_JSON", "Invalid JSON body", 400);
  }

  const action = str(body.action, 32);

  switch (action) {
    // ---- CREATE -----------------------------------------------------------
    case "create": {
      const permErr = requirePermission(user, "media", "create");
      if (permErr) return permErr;

      const mediaType = str(body.media_type, 16) || "image";
      if (
        !(VALID_MEDIA_TYPES as readonly string[]).includes(
          mediaType as (typeof VALID_MEDIA_TYPES)[number],
        )
      ) {
        return fail("INVALID_TYPE", "Invalid media_type", 400);
      }
      const source = str(body.source, 16) || "upload";
      if (
        !(VALID_SOURCES as readonly string[]).includes(source as (typeof VALID_SOURCES)[number])
      ) {
        return fail("INVALID_SOURCE", "Invalid source", 400);
      }

      const id = uid("ma");
      const t = now();
      const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.slice(0, 20)) : "[]";

      await db
        .prepare(
          `INSERT INTO media_assets
         (id, filename, mime_type, file_size, width, height, r2_key, public_url,
          alt_text, title, description, tags_json, media_type, source, video_asset_id,
          linked_entity_type, linked_entity_id, sort_order, featured,
          created_at, updated_at, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          id,
          str(body.filename, 255),
          str(body.mime_type, 127),
          num(body.file_size),
          num(body.width),
          num(body.height),
          str(body.r2_key),
          str(body.public_url),
          str(body.alt_text, 500),
          str(body.title, 300),
          str(body.description, 2000),
          tags,
          mediaType,
          source,
          str(body.video_asset_id, 64),
          str(body.linked_entity_type, 32),
          str(body.linked_entity_id, 64),
          num(body.sort_order),
          body.featured ? 1 : 0,
          t,
          t,
          user.id,
        )
        .run();

      return ok({ id });
    }

    // ---- LINK -------------------------------------------------------------
    case "link": {
      const permErr = requirePermission(user, "media", "edit");
      if (permErr) return permErr;

      const mediaId = str(body.media_id, 64);
      const entityType = str(body.entity_type, 32);
      const entityId = str(body.entity_id, 64);
      if (!mediaId || !entityType || !entityId) {
        return fail("MISSING_FIELDS", "media_id, entity_type, entity_id required", 400);
      }

      const asset = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at = ''")
        .bind(mediaId)
        .first();
      if (!asset) return fail("NOT_FOUND", "Media asset not found", 404);

      const linkId = uid("ml");
      await db
        .prepare(
          `INSERT OR IGNORE INTO media_links (id, media_id, entity_type, entity_id, sort_order, created_at)
         VALUES (?,?,?,?,?,?)`,
        )
        .bind(linkId, mediaId, entityType, entityId, num(body.sort_order), now())
        .run();

      return ok({ link_id: linkId });
    }

    // ---- UNLINK -----------------------------------------------------------
    case "unlink": {
      const permErr = requirePermission(user, "media", "edit");
      if (permErr) return permErr;

      const mediaId = str(body.media_id, 64);
      const entityType = str(body.entity_type, 32);
      const entityId = str(body.entity_id, 64);
      if (!mediaId || !entityType || !entityId) {
        return fail("MISSING_FIELDS", "media_id, entity_type, entity_id required", 400);
      }

      await db
        .prepare("DELETE FROM media_links WHERE media_id = ? AND entity_type = ? AND entity_id = ?")
        .bind(mediaId, entityType, entityId)
        .run();

      return ok({ deleted: true });
    }

    // ---- SOFT DELETE -------------------------------------------------------
    case "soft_delete": {
      const permErr = requirePermission(user, "media", "delete");
      if (permErr) return permErr;

      const id = str(body.id, 64);
      if (!id) return fail("MISSING_ID", "id required", 400);

      const asset = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at = ''")
        .bind(id)
        .first();
      if (!asset) return fail("NOT_FOUND", "Media asset not found", 404);

      const t = now();
      await db
        .prepare(
          "UPDATE media_assets SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?",
        )
        .bind(t, user.id, t, id)
        .run();

      return ok({ id, deleted_at: t });
    }

    // ---- RESTORE ----------------------------------------------------------
    case "restore": {
      const permErr = requirePermission(user, "media", "delete");
      if (permErr) return permErr;

      const id = str(body.id, 64);
      if (!id) return fail("MISSING_ID", "id required", 400);

      const asset = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at != ''")
        .bind(id)
        .first();
      if (!asset) return fail("NOT_FOUND", "Deleted media asset not found", 404);

      await db
        .prepare(
          "UPDATE media_assets SET deleted_at = '', deleted_by = '', updated_at = ? WHERE id = ?",
        )
        .bind(now(), id)
        .run();

      return ok({ id, restored: true });
    }

    // ---- UPDATE -----------------------------------------------------------
    case "update": {
      const permErr = requirePermission(user, "media", "edit");
      if (permErr) return permErr;

      const id = str(body.id, 64);
      if (!id) return fail("MISSING_ID", "id required", 400);

      const asset = await db
        .prepare("SELECT id FROM media_assets WHERE id = ? AND deleted_at = ''")
        .bind(id)
        .first();
      if (!asset) return fail("NOT_FOUND", "Media asset not found", 404);

      const fields: string[] = [];
      const vals: unknown[] = [];

      const allowUpdate: Array<[string, (v: unknown) => unknown, number]> = [
        ["title", (v) => str(v, 300), 300],
        ["description", (v) => str(v, 2000), 2000],
        ["alt_text", (v) => str(v, 500), 500],
        ["filename", (v) => str(v, 255), 255],
      ];

      for (const [col, fn] of allowUpdate) {
        if (body[col] !== undefined) {
          fields.push(`${col} = ?`);
          vals.push(fn(body[col]));
        }
      }

      if (body.tags !== undefined) {
        fields.push("tags_json = ?");
        vals.push(Array.isArray(body.tags) ? JSON.stringify(body.tags.slice(0, 20)) : "[]");
      }

      if (body.featured !== undefined) {
        fields.push("featured = ?");
        vals.push(body.featured ? 1 : 0);
      }

      if (body.sort_order !== undefined) {
        fields.push("sort_order = ?");
        vals.push(num(body.sort_order));
      }

      if (body.linked_entity_type !== undefined) {
        fields.push("linked_entity_type = ?");
        vals.push(str(body.linked_entity_type, 32));
      }

      if (body.linked_entity_id !== undefined) {
        fields.push("linked_entity_id = ?");
        vals.push(str(body.linked_entity_id, 64));
      }

      if (fields.length === 0) return fail("NOTHING_TO_UPDATE", "No fields to update", 400);

      fields.push("updated_at = ?");
      vals.push(now());
      vals.push(id);

      await db
        .prepare(`UPDATE media_assets SET ${fields.join(", ")} WHERE id = ?`)
        .bind(...vals)
        .run();

      return ok({ id });
    }

    // ---- BULK DELETE ------------------------------------------------------
    case "bulk_delete": {
      const permErr = requirePermission(user, "media", "delete");
      if (permErr) return permErr;

      const ids = Array.isArray(body.ids)
        ? body.ids.map((id: unknown) => str(id, 64)).filter(Boolean)
        : [];
      if (ids.length === 0) return fail("MISSING_IDS", "ids array required", 400);
      if (ids.length > 50) return fail("TOO_MANY", "Max 50 items per bulk operation", 400);

      const t = now();
      const placeholders = ids.map(() => "?").join(",");
      await db
        .prepare(
          `UPDATE media_assets SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id IN (${placeholders}) AND deleted_at = ''`,
        )
        .bind(t, user.id, t, ...ids)
        .run();

      return ok({ deleted: ids.length });
    }

    default:
      return fail("UNKNOWN_ACTION", `Unknown action: ${action}`, 400);
  }
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  if (request.method === "GET") return handleGet(request, env);
  if (request.method === "POST") return handlePost(request, env);
  return fail("METHOD_NOT_ALLOWED", "Method not allowed", 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
