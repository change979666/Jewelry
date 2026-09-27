// ============================================================================
// GET/POST/DELETE /api/admin/v2/commerce/ops
// 运营配置统一管理层（Phase 1 骨架）：
//   view=source_map        来源分类映射（1688/Alibaba/CSV/Supplier/AI Import）
//   view=channels          Feed 渠道（meta/google/...）
//   view=export_templates  导出模板
//   view=seo_pages         SEO Landing Page 注册表
//   view=suggestions       AI 建议审核队列（shop_ai_suggestions）
// 铁律：商品原始数据（commerce_products）只读，这里绝不改商品。
// ============================================================================

import type { AdminEnv } from "../../shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { parseJsonBody } from "../../../../lib/safe";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    {
      status,
      headers: { "Content-Type": "application/json" },
    },
  );
}
function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

const VIEWS = ["source_map", "channels", "export_templates", "seo_pages", "suggestions"] as const;
type View = (typeof VIEWS)[number];

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  const db = env.DB;
  const url = new URL(request.url);
  const view = (url.searchParams.get("view") || "suggestions") as View;
  if (!VIEWS.includes(view))
    return fail("VALIDATION_ERROR", `view must be one of ${VIEWS.join(",")}`, 422);

  try {
    // ── GET ────────────────────────────────────────────────────────────────
    if (request.method === "GET") {
      const permErr = requirePermission(user, "commerce", "view");
      if (permErr) return permErr;
      const limit = Math.min(Number(url.searchParams.get("limit") || 50), 200);
      const offset = Math.max(Number(url.searchParams.get("offset") || 0), 0);
      if (view === "source_map") {
        const { results } = await db
          .prepare(
            "SELECT * FROM shop_category_source_map ORDER BY verified ASC, id DESC LIMIT ? OFFSET ?",
          )
          .bind(limit, offset)
          .all();
        const total =
          (
            await db
              .prepare("SELECT COUNT(*) c FROM shop_category_source_map")
              .first<{ c: number }>()
          )?.c || 0;
        return ok({ items: results, total });
      }
      if (view === "channels") {
        const { results } = await db.prepare("SELECT * FROM shop_feed_channels ORDER BY id").all();
        return ok({ items: results });
      }
      if (view === "export_templates") {
        const { results } = await db
          .prepare("SELECT * FROM shop_export_templates ORDER BY id DESC")
          .all();
        return ok({ items: results });
      }
      if (view === "seo_pages") {
        const { results } = await db
          .prepare("SELECT * FROM shop_seo_pages ORDER BY id DESC LIMIT ? OFFSET ?")
          .bind(limit, offset)
          .all();
        const total =
          (await db.prepare("SELECT COUNT(*) c FROM shop_seo_pages").first<{ c: number }>())?.c ||
          0;
        return ok({ items: results, total });
      }
      // suggestions
      const status = url.searchParams.get("status");
      const where = status ? "WHERE review_status = ?" : "";
      const binds: unknown[] = status ? [status] : [];
      const { results } = await db
        .prepare(
          `SELECT * FROM shop_ai_suggestions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        )
        .bind(...binds, limit, offset)
        .all();
      const total =
        (
          await db
            .prepare(`SELECT COUNT(*) c FROM shop_ai_suggestions ${where}`)
            .bind(...binds)
            .first<{ c: number }>()
        )?.c || 0;
      const byStatus = await db
        .prepare("SELECT review_status, COUNT(*) c FROM shop_ai_suggestions GROUP BY review_status")
        .all();
      return ok({ items: results, total, by_status: byStatus.results });
    }

    // ── POST ───────────────────────────────────────────────────────────────
    if (request.method === "POST") {
      const permErr = requirePermission(user, "commerce", "edit");
      if (permErr) return permErr;
      const parsed = await parseJsonBody<Record<string, unknown>>(request);
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
      const d = (body.data || {}) as Record<string, unknown>;
      const action = String(body.action || "upsert");

      if (view === "source_map") {
        // 来源分类 → Canonical 分类映射（为多来源导入预留统一入口）
        if (!d.source_platform || d.source_category_id == null)
          return fail("VALIDATION_ERROR", "source_platform + source_category_id required", 422);
        if (action === "toggle_verified" && d.id != null) {
          await db
            .prepare("UPDATE shop_category_source_map SET verified = 1 - verified WHERE id = ?")
            .bind(d.id)
            .run();
          return ok({ toggled: d.id });
        }
        await db
          .prepare(
            `INSERT INTO shop_category_source_map (source_platform, source_category_id, source_category_name, category_id, confidence, verified)
           VALUES (?,?,?,?,?,?)
           ON CONFLICT(source_platform, source_category_id) DO UPDATE SET
             source_category_name=excluded.source_category_name, category_id=excluded.category_id,
             confidence=excluded.confidence, verified=excluded.verified`,
          )
          .bind(
            String(d.source_platform),
            String(d.source_category_id),
            d.source_category_name || "",
            d.category_id ?? null,
            Number(d.confidence ?? 50),
            Number(d.verified ?? 0),
          )
          .run();
        return ok({ saved: true });
      }

      if (view === "channels") {
        if (!d.channel) return fail("VALIDATION_ERROR", "channel required", 422);
        await db
          .prepare(
            `INSERT INTO shop_feed_channels (channel, name, feed_url, status) VALUES (?,?,?,?)
           ON CONFLICT(channel) DO UPDATE SET name=excluded.name, feed_url=excluded.feed_url, status=excluded.status`,
          )
          .bind(String(d.channel), d.name || "", d.feed_url || "", d.status || "draft")
          .run();
        return ok({ saved: true });
      }

      if (view === "export_templates") {
        if (!d.name) return fail("VALIDATION_ERROR", "name required", 422);
        if (d.id != null) {
          await db
            .prepare(
              "UPDATE shop_export_templates SET name=?, format=?, fields_json=?, filters_json=? WHERE id=?",
            )
            .bind(
              d.name,
              d.format || "csv",
              JSON.stringify(d.fields || []),
              JSON.stringify(d.filters || {}),
              d.id,
            )
            .run();
          return ok({ updated: d.id });
        }
        const r = await db
          .prepare(
            "INSERT INTO shop_export_templates (name, format, fields_json, filters_json, created_by) VALUES (?,?,?,?,?)",
          )
          .bind(
            d.name,
            d.format || "csv",
            JSON.stringify(d.fields || []),
            JSON.stringify(d.filters || {}),
            user.username,
          )
          .run();
        return ok({ created: r.meta.last_row_id });
      }

      if (view === "seo_pages") {
        if (!d.slug) return fail("VALIDATION_ERROR", "slug required", 422);
        if (action === "set_indexability" && d.id != null) {
          await db
            .prepare(
              "UPDATE shop_seo_pages SET indexability=?, updated_at=datetime('now') WHERE id=?",
            )
            .bind(String(d.indexability || "candidate"), d.id)
            .run();
          return ok({ updated: d.id });
        }
        if (d.id != null) {
          await db
            .prepare(
              `UPDATE shop_seo_pages SET slug=?, source_type=?, source_id=?, source_label=?, indexability=?, status=?, seo_title_json=?, seo_description_json=?, intro_json=?, faq_json=?, generated_by=?, updated_at=datetime('now') WHERE id=?`,
            )
            .bind(
              d.slug,
              d.source_type || "category",
              d.source_id ?? null,
              d.source_label || "",
              d.indexability || "candidate",
              d.status || "draft",
              JSON.stringify(d.seo_title || {}),
              JSON.stringify(d.seo_description || {}),
              JSON.stringify(d.intro || {}),
              JSON.stringify(d.faq || {}),
              d.generated_by || "manual",
              d.id,
            )
            .run();
          return ok({ updated: d.id });
        }
        const r = await db
          .prepare(
            `INSERT INTO shop_seo_pages (slug, source_type, source_id, source_label, eligibility_score, indexability, status, seo_title_json, seo_description_json, intro_json, faq_json, generated_by)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
          )
          .bind(
            d.slug,
            d.source_type || "category",
            d.source_id ?? null,
            d.source_label || "",
            Number(d.eligibility_score ?? 0),
            d.indexability || "candidate",
            d.status || "draft",
            JSON.stringify(d.seo_title || {}),
            JSON.stringify(d.seo_description || {}),
            JSON.stringify(d.intro || {}),
            JSON.stringify(d.faq || {}),
            d.generated_by || "manual",
          )
          .run();
        return ok({ created: r.meta.last_row_id });
      }

      // suggestions：审核动作（接受/拒绝/批量）——只改建议状态，绝不直接改商品
      if (action === "review" && d.id != null) {
        const decision = String(d.decision || "");
        if (!["accepted", "rejected", "pending"].includes(decision))
          return fail("VALIDATION_ERROR", "decision must be accepted/rejected/pending", 422);
        await db
          .prepare(
            "UPDATE shop_ai_suggestions SET review_status=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id=?",
          )
          .bind(decision, user.username, d.id)
          .run();
        return ok({ reviewed: d.id, decision });
      }
      if (action === "review_batch" && Array.isArray(d.ids)) {
        const decision = String(d.decision || "accepted");
        if (!["accepted", "rejected"].includes(decision))
          return fail("VALIDATION_ERROR", "decision must be accepted/rejected", 422);
        const ph = (d.ids as unknown[]).map(() => "?").join(",");
        const r = await db
          .prepare(
            `UPDATE shop_ai_suggestions SET review_status=?, reviewed_by=?, reviewed_at=datetime('now') WHERE id IN (${ph}) AND review_status='pending'`,
          )
          .bind(decision, user.username, ...(d.ids as unknown[]))
          .run();
        return ok({ reviewed: r.meta.changes, decision });
      }
      return fail("VALIDATION_ERROR", "unknown action", 422);
    }

    // ── DELETE：软停用 ────────────────────────────────────────────────────
    if (request.method === "DELETE") {
      const permErr = requirePermission(user, "commerce", "edit");
      if (permErr) return permErr;
      const id = url.searchParams.get("id");
      if (!id) return fail("VALIDATION_ERROR", "id required", 422);
      const tableMap: Record<View, string> = {
        source_map: "shop_category_source_map",
        channels: "shop_feed_channels",
        export_templates: "shop_export_templates",
        seo_pages: "shop_seo_pages",
        suggestions: "shop_ai_suggestions",
      };
      if (view === "channels" || view === "export_templates") {
        await db.prepare(`DELETE FROM ${tableMap[view]} WHERE id = ?`).bind(id).run();
        return ok({ deleted: id });
      }
      if (view === "source_map") {
        await db.prepare("DELETE FROM shop_category_source_map WHERE id = ?").bind(id).run();
        return ok({ deleted: id });
      }
      if (view === "seo_pages") {
        await db
          .prepare(
            "UPDATE shop_seo_pages SET status='archived', updated_at=datetime('now') WHERE id=?",
          )
          .bind(id)
          .run();
        return ok({ archived: id });
      }
      return fail("VALIDATION_ERROR", "suggestions 不支持删除，请用审核动作", 422);
    }

    return fail("METHOD_NOT_ALLOWED", "Use GET/POST/DELETE", 405);
  } catch (e) {
    return fail("INTERNAL_ERROR", e instanceof Error ? e.message : String(e), 500);
  }
}
