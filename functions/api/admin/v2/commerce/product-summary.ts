// ============================================================================
// GET /api/admin/v2/commerce/product-summary?id= — 商品工作台（V5.55 §15）
//
// 单品聚合：同一个商品打开后看到 Knowledge / Images / Videos / AI Tasks / SEO。
// 全部走索引/限量查询，配额友好；只读。
// ============================================================================

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { guardAllows, PRIORITY } from "../../../../lib/d1-guard";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}
function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);
  const user = await authenticateRequest(request, env);
  const authHdr = request.headers.get("Authorization") || "";
  const bearer = authHdr.replace(/^Bearer\s+/i, "").trim();
  const isCron = Boolean(env.CRON_SECRET && bearer && bearer === env.CRON_SECRET);
  if (!user && !isCron) return fail("UNAUTHORIZED", "Login required", 401);
  if (user) {
    const permErr = requirePermission(user, "commerce", "view");
    if (permErr) return fail("FORBIDDEN", "Missing permission: commerce:view", 403);
  }

  // V5.56 资源保护：聚合接口在配额熔断时降级（不查 D1）。
  const gate = await guardAllows(env, PRIORITY.AGGREGATION);
  if (!gate.allowed) {
    return fail("GUARD_DEGRADED", `D1 guard state=${gate.state}，商品工作台聚合配额保护降级`, 503);
  }

  const url = new URL(request.url);
  const id = url.searchParams.get("id") || "";
  if (!id) return fail("VALIDATION_ERROR", "id required", 422);
  const db = env.DB;

  try {
    // 商品主体
    const p = await db
      .prepare(
        `SELECT id, product_key, slug, title, short_name, category, status, cover_image,
                seo_title, seo_description, localization_status, source_platform, source_product_key
         FROM commerce_products WHERE id = ? OR product_key = ? OR slug = ? LIMIT 1`,
      )
      .bind(id, id, id)
      .first<Record<string, unknown>>();
    if (!p) return fail("NOT_FOUND", "product not found", 404);
    const pid = String(p.id);
    const slug = String(p.slug || "");

    // Knowledge：该商品的事实/候选/冲突（linked_entity 匹配 id 或 slug）
    let knowledge = { facts: 0, candidates: 0, conflicts: 0, items: [] as unknown[] };
    try {
      const kq = await db
        .prepare(
          `SELECT status, COUNT(*) c FROM knowledge_v2
           WHERE linked_entity_id IN (?, ?) GROUP BY status`,
        )
        .bind(pid, slug)
        .all<{ status: string; c: number }>();
      let facts = 0,
        candidates = 0;
      for (const r of kq.results) {
        if (r.status === "active") facts += r.c;
        else if (r.status === "review" || r.status === "draft") candidates += r.c;
      }
      const items = await db
        .prepare(
          `SELECT id, title, substr(content,1,120) content, source, confidence, status
           FROM knowledge_v2 WHERE linked_entity_id IN (?, ?)
           ORDER BY status, confidence DESC LIMIT 20`,
        )
        .bind(pid, slug)
        .all();
      const conf = await db
        .prepare(
          `SELECT COUNT(*) c FROM (SELECT 1 FROM knowledge_v2
            WHERE linked_entity_id IN (?, ?) AND status IN ('active','review','draft')
            GROUP BY category HAVING COUNT(DISTINCT content) > 1)`,
        )
        .bind(pid, slug)
        .first<{ c: number }>();
      knowledge = { facts, candidates, conflicts: conf?.c ?? 0, items: items.results };
    } catch {
      /* knowledge_v2 可能尚未接入 */
    }

    // Images：本地化审阅明细（Studio 同步）
    let images = { original: 0, localized: 0, review: 0, items: [] as unknown[] };
    try {
      const ri = await db
        .prepare(
          `SELECT item_key, verdict, routing, publish_state, original_url, final_url
           FROM studio_review_items WHERE product_id = ? ORDER BY updated_at DESC LIMIT 20`,
        )
        .bind(pid)
        .all();
      const arr = ri.results as Array<Record<string, unknown>>;
      images = {
        original: arr.length,
        localized: arr.filter((x) => x.final_url).length,
        review: arr.filter((x) => ["REVIEW", "WARN", "FAIL"].includes(String(x.verdict))).length,
        items: arr,
      };
    } catch {
      /* studio_review_items 尚未同步 */
    }

    // Videos：关联视频
    let vids = { total: 0, localized: 0, items: [] as unknown[] };
    try {
      const vr = await db
        .prepare(
          `SELECT a.id, a.video_code, a.internal_title, a.cover_url, a.processing_status, a.editorial_status
           FROM video_product_links l JOIN video_assets a ON a.id = l.video_id
           WHERE l.product_id = ? LIMIT 10`,
        )
        .bind(pid)
        .all();
      const va = vr.results as Array<Record<string, unknown>>;
      vids = {
        total: va.length,
        localized: va.filter((x) => x.processing_status === "ready").length,
        items: va,
      };
    } catch {
      /* 视频表未接入 */
    }

    // AI Tasks：针对该商品的任务
    let tasks = { total: 0, review: 0, completed: 0, items: [] as unknown[] };
    try {
      const tr = await db
        .prepare(
          `SELECT status, COUNT(*) c FROM ai_tasks WHERE target_id = ? AND target_type='product' GROUP BY status`,
        )
        .bind(pid)
        .all<{ status: string; c: number }>();
      let total = 0,
        review = 0,
        completed = 0;
      for (const r of tr.results) {
        total += r.c;
        if (r.status === "awaiting_approval") review += r.c;
        if (r.status === "completed") completed += r.c;
      }
      const items = await db
        .prepare(
          `SELECT id, title, task_type, status, updated_at FROM ai_tasks
           WHERE target_id = ? AND target_type='product' ORDER BY updated_at DESC LIMIT 10`,
        )
        .bind(pid)
        .all();
      tasks = { total, review, completed, items: items.results };
    } catch {
      /* ai_tasks 未接入 */
    }

    // SEO：静态页 / 可索引性（基于商品自身字段）
    const seo = {
      slug,
      has_seo_title: Boolean(p.seo_title),
      has_seo_description: Boolean(p.seo_description),
      status: p.status,
      localization_status: p.localization_status,
      indexable: p.status === "active",
    };

    return ok({ product: p, knowledge, images, videos: vids, tasks, seo });
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : String(e), 500);
  }
}
