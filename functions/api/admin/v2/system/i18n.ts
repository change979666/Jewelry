// Phase 11 — i18n Translation Management API
// GET    — list locales / list translations (with filters)
// POST   — create translation / add locale
// PUT    — update translation / update translation status
// DELETE — delete translation

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";

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

function str(v: unknown, max = 500): string {
  return typeof v === "string" ? v.slice(0, max).trim() : "";
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") || "";

  // GET
  if (request.method === "GET") {
    const permErr = requirePermission(user, "system", "view");
    if (permErr) return permErr;

    // ?resource=locales — list locales
    if (resource === "locales") {
      const rows = await env.DB.prepare(
        "SELECT * FROM i18n_locales ORDER BY is_default DESC, name",
      ).all();
      return ok(rows.results);
    }

    // Default: list translations
    const locale = url.searchParams.get("locale") || "";
    const namespace = url.searchParams.get("namespace") || "";
    const status = url.searchParams.get("status") || "";
    const search = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "50")));
    const offset = (page - 1) * pageSize;

    let where = "WHERE 1=1";
    const binds: unknown[] = [];
    if (locale) {
      where += " AND t.locale = ?";
      binds.push(locale);
    }
    if (namespace) {
      where += " AND t.namespace = ?";
      binds.push(namespace);
    }
    if (status) {
      where += " AND t.status = ?";
      binds.push(status);
    }
    if (search) {
      where += " AND (t.key LIKE ? OR t.value LIKE ?)";
      binds.push(`%${search}%`, `%${search}%`);
    }

    const countRow = await env.DB.prepare(
      `SELECT COUNT(*) as total FROM i18n_translations t ${where}`,
    )
      .bind(...binds)
      .first<{ total: number }>();
    const total = countRow?.total ?? 0;

    const rows = await env.DB.prepare(
      `SELECT t.*, l.name as locale_name FROM i18n_translations t LEFT JOIN i18n_locales l ON t.locale = l.code ${where} ORDER BY t.locale, t.namespace, t.key LIMIT ? OFFSET ?`,
    )
      .bind(...binds, pageSize, offset)
      .all();

    return ok(rows.results, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }

  // POST — create translation or locale
  if (request.method === "POST") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const action = str(body.action, 32);

    if (action === "add_locale") {
      const code = str(body.code, 10).toLowerCase();
      const name = str(body.name, 50);
      const nativeName = str(body.native_name, 50);
      if (!code || !name) return fail("VALIDATION_ERROR", "code and name required", 422);

      try {
        await env.DB.prepare("INSERT INTO i18n_locales (code, name, native_name) VALUES (?, ?, ?)")
          .bind(code, name, nativeName || name)
          .run();
      } catch (e) {
        if (String(e).includes("UNIQUE")) return fail("CONFLICT", "Locale already exists", 409);
        throw e;
      }
      return ok({ code, name });
    }

    // Default: create translation
    const locale = str(body.locale, 10);
    const namespace = str(body.namespace, 32) || "ui";
    const key = str(body.key, 200);
    const value = str(body.value, 5000);
    if (!locale || !key) return fail("VALIDATION_ERROR", "locale and key required", 422);

    const id = `i18n_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`;
    try {
      await env.DB.prepare(
        "INSERT INTO i18n_translations (id, locale, namespace, key, value, status, updated_by) VALUES (?, ?, ?, ?, ?, 'translated', ?)",
      )
        .bind(id, locale, namespace, key, value, user.username)
        .run();
    } catch (e) {
      if (String(e).includes("UNIQUE"))
        return fail("CONFLICT", "Translation key already exists for this locale", 409);
      throw e;
    }
    return ok({ id });
  }

  // PUT — update translation
  if (request.method === "PUT") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const id = str(body.id, 64);
    if (!id) return fail("VALIDATION_ERROR", "id required", 422);

    const fields: string[] = [];
    const vals: unknown[] = [];

    if (body.value !== undefined) {
      fields.push("value = ?");
      vals.push(str(body.value, 5000));
    }
    if (body.status !== undefined) {
      const s = str(body.status, 20);
      if (!["pending", "translated", "reviewed", "approved"].includes(s))
        return fail("VALIDATION_ERROR", "Invalid status", 422);
      fields.push("status = ?");
      vals.push(s);
    }

    if (fields.length === 0) return fail("VALIDATION_ERROR", "No fields to update", 422);

    fields.push("updated_by = ?");
    vals.push(user.username);
    fields.push("updated_at = CURRENT_TIMESTAMP");
    vals.push(id);

    const result = await env.DB.prepare(
      `UPDATE i18n_translations SET ${fields.join(", ")} WHERE id = ?`,
    )
      .bind(...vals)
      .run();
    if (result.meta.changes === 0) return fail("NOT_FOUND", "Translation not found", 404);

    return ok({ id, updated: true });
  }

  // DELETE — delete translation
  if (request.method === "DELETE") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    const id = url.searchParams.get("id") || "";
    if (!id) return fail("VALIDATION_ERROR", "id required", 422);

    const result = await env.DB.prepare("DELETE FROM i18n_translations WHERE id = ?")
      .bind(id)
      .run();
    if (result.meta.changes === 0) return fail("NOT_FOUND", "Translation not found", 404);

    return ok({ id, deleted: true });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, PUT, or DELETE", 405);
}
