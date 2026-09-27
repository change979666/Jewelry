// Phase 11 — Knowledge Base V2 API (L0-L4 layers)
// GET    — list knowledge entries (filters: layer, category, search, importance)
// POST   — create knowledge entry
// PUT    — update knowledge entry
// DELETE — delete knowledge entry

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { logAction } from "../../../../lib/admin/audit";

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

function str(v: unknown, max = 5000): string {
  return typeof v === "string" ? v.slice(0, max).trim() : "";
}

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? Math.max(min, Math.min(max, Math.round(n))) : fallback;
}

const VALID_LAYERS = ["L0", "L1", "L2", "L3", "L4"];

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);

  // GET
  if (request.method === "GET") {
    const permErr = requirePermission(user, "system", "view");
    if (permErr) return permErr;

    const url = new URL(request.url);
    const layer = url.searchParams.get("layer") || "";
    const category = url.searchParams.get("category") || "";
    const search = url.searchParams.get("q") || "";
    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const pageSize = Math.min(100, Math.max(1, parseInt(url.searchParams.get("pageSize") || "30")));
    const offset = (page - 1) * pageSize;

    let where = "WHERE 1=1";
    const binds: unknown[] = [];
    if (layer && VALID_LAYERS.includes(layer)) {
      where += " AND layer = ?";
      binds.push(layer);
    }
    if (category) {
      where += " AND category = ?";
      binds.push(category);
    }
    if (search) {
      where += " AND (title LIKE ? OR content LIKE ?)";
      binds.push(`%${search}%`, `%${search}%`);
    }

    const countRow = await env.DB.prepare(`SELECT COUNT(*) as total FROM knowledge_v2 ${where}`)
      .bind(...binds)
      .first<{ total: number }>();
    const total = countRow?.total ?? 0;

    const rows = await env.DB.prepare(
      `SELECT * FROM knowledge_v2 ${where} ORDER BY importance DESC, updated_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...binds, pageSize, offset)
      .all();

    // Parse tags_json
    const items = rows.results.map((r: Record<string, unknown>) => ({
      ...r,
      tags: (() => {
        try {
          return JSON.parse(String(r.tags_json || "[]"));
        } catch {
          return [];
        }
      })(),
    }));

    return ok(items, { page, pageSize, total, totalPages: Math.ceil(total / pageSize) });
  }

  // POST — create
  if (request.method === "POST") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    let body: Record<string, unknown>;
    try {
      body = (await request.json()) as Record<string, unknown>;
    } catch {
      return fail("INVALID_JSON", "Invalid JSON", 400);
    }

    const layer = str(body.layer, 10) || "L0";
    if (!VALID_LAYERS.includes(layer))
      return fail("VALIDATION_ERROR", `Invalid layer. Use: ${VALID_LAYERS.join(", ")}`, 422);

    const category = str(body.category, 60) || "general";
    const title = str(body.title, 300);
    const content = str(body.content, 10000);
    if (!title) return fail("VALIDATION_ERROR", "title required", 422);
    // S38：正文必填——空正文知识不得进入 Knowledge Center（即便以 draft 起步）。
    if (!content || !content.trim())
      return fail("VALIDATION_ERROR", "content required (empty-body knowledge is rejected)", 422);

    const source = str(body.source, 40) || "manual";
    const importance = num(body.importance, 1, 10, 5);
    const confidence = num(body.confidence, 0, 100, 50);
    const tags = Array.isArray(body.tags) ? JSON.stringify(body.tags.slice(0, 20)) : "[]";

    const id = `kb_${Date.now().toString(36)}${crypto.randomUUID().slice(0, 6)}`;
    const now = new Date().toISOString();

    // V5.54 知识等级护栏：任何新建一律从 draft 起步，绝不直接 active/verified；
    // 进入可信集必须走 Knowledge Center 的批量批准（review→active）。
    await env.DB.prepare(
      `INSERT INTO knowledge_v2 (id, layer, category, title, content, source, importance, confidence, tags_json, created_by, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
    )
      .bind(
        id,
        layer,
        category,
        title,
        content,
        source,
        importance,
        confidence,
        tags,
        user.username,
        now,
        now,
      )
      .run();

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "create",
      resource_type: "knowledge",
      resource_id: id,
      resource_title: title,
      change_summary: `Created knowledge entry [${layer}] ${category}: ${title}`,
    });

    return ok({ id });
  }

  // PUT — update
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

    if (body.layer !== undefined) {
      const l = str(body.layer, 10);
      if (!VALID_LAYERS.includes(l)) return fail("VALIDATION_ERROR", "Invalid layer", 422);
      fields.push("layer = ?");
      vals.push(l);
    }
    if (body.category !== undefined) {
      fields.push("category = ?");
      vals.push(str(body.category, 60));
    }
    if (body.title !== undefined) {
      fields.push("title = ?");
      vals.push(str(body.title, 300));
    }
    if (body.content !== undefined) {
      fields.push("content = ?");
      vals.push(str(body.content, 10000));
    }
    if (body.importance !== undefined) {
      fields.push("importance = ?");
      vals.push(num(body.importance, 1, 10, 5));
    }
    if (body.confidence !== undefined) {
      fields.push("confidence = ?");
      vals.push(num(body.confidence, 0, 100, 50));
    }
    if (body.tags !== undefined) {
      fields.push("tags_json = ?");
      vals.push(Array.isArray(body.tags) ? JSON.stringify(body.tags.slice(0, 20)) : "[]");
    }
    if (body.embedding_status !== undefined) {
      const es = str(body.embedding_status, 20);
      if (["pending", "indexed", "error"].includes(es)) {
        fields.push("embedding_status = ?");
        vals.push(es);
      }
    }

    if (fields.length === 0) return fail("VALIDATION_ERROR", "No fields to update", 422);

    fields.push("updated_at = CURRENT_TIMESTAMP");
    vals.push(id);

    const result = await env.DB.prepare(`UPDATE knowledge_v2 SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...vals)
      .run();
    if (result.meta.changes === 0) return fail("NOT_FOUND", "Knowledge entry not found", 404);

    return ok({ id, updated: true });
  }

  // DELETE
  if (request.method === "DELETE") {
    const permErr = requirePermission(user, "system", "manage_settings");
    if (permErr) return permErr;

    const id = new URL(request.url).searchParams.get("id") || "";
    if (!id) return fail("VALIDATION_ERROR", "id required", 422);

    const result = await env.DB.prepare("DELETE FROM knowledge_v2 WHERE id = ?").bind(id).run();
    if (result.meta.changes === 0) return fail("NOT_FOUND", "Knowledge entry not found", 404);

    await logAction(env, {
      actor_type: "human",
      user_id: user.id,
      username: user.username,
      action: "delete",
      resource_type: "knowledge",
      resource_id: id,
      change_summary: `Deleted knowledge entry ${id}`,
    });

    return ok({ id, deleted: true });
  }

  return fail("METHOD_NOT_ALLOWED", "Use GET, POST, PUT, or DELETE", 405);
}
