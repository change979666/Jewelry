// Phase 3 — Dashboard KPI endpoint
// 4 KPIs: inquiries this month, order total this month, site users (no source → null), AI completed this month
// Each KPI gated by its module permission.
//
// S14（静默失败整改）：过去每个 KPI 查询抛错时 catch 留空 → 值保持 null，与「无权限」
// 「无数据」完全同形，仪表盘只能显示「—」，把 DB 故障读成「没权限/没数据」。
// 现在每个 KPI 额外返回三态信封 { value, state, source, error? }：
//   state ∈ HAS_DATA / REAL_ZERO / NO_DATA / ERROR / NO_PERMISSION
//   —— ERROR（查询失败）绝不塌缩成裸 null 被读成「无数据」。
// 为不破坏现有前端（src/ 仍按标量读取），标量字段原样保留，其值 = 信封 value。
// 前端后续可改读 envelopes[*].state 区分「真的是 0/无」与「查询失败/无权限」。

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, checkPermission } from "../../../../lib/admin/rbac";

function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

// S14: KPI 三态。NO_DATA = 结构性无数据源；NO_PERMISSION = 缺权限（非故障）；
// ERROR = 查询抛错（故障，必须与上面两者可分）。
type KpiState = "HAS_DATA" | "REAL_ZERO" | "NO_DATA" | "ERROR" | "NO_PERMISSION";

interface KpiEnvelope<T = number | null> {
  value: T;
  state: KpiState;
  source: string;
  error?: string;
}

function noPerm<T = number | null>(source: string): KpiEnvelope<T> {
  return { value: null as unknown as T, state: "NO_PERMISSION", source };
}
function errEnv<T = number | null>(source: string, e: unknown): KpiEnvelope<T> {
  return {
    value: null as unknown as T,
    state: "ERROR",
    source,
    error: e instanceof Error ? e.message : String(e),
  };
}
/** COUNT/SUM 型：0 是真实的 0（REAL_ZERO），>0 是 HAS_DATA。 */
function countEnv(source: string, v: number | null | undefined): KpiEnvelope<number | null> {
  const n = Number(v ?? 0);
  return { value: n, state: n > 0 ? "HAS_DATA" : "REAL_ZERO", source };
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return fail("UNAUTHORIZED", "Login required", 401);
  if (request.method !== "GET") return fail("METHOD_NOT_ALLOWED", "Use GET", 405);
  if (!env.DB) return fail("INTERNAL_ERROR", "Database unavailable", 500);

  // 统一时间边界（2026-09-03 修复）：单一 UTC 计算源。
  // unix 时间戳列（commerce_orders.created_at / ai_missions.completed_at）用 ts 比较；
  // ISO 文本列（inquiries.created_at）用 ISO 字符串比较。禁止 unix/datetime 混比
  // （此前 completed_at unix 与 datetime() 文本比较，SQLite 类型序 INTEGER<TEXT 恒真 → 恒 0）。
  const nowD = new Date();
  const monthStartUtcMs = Date.UTC(nowD.getUTCFullYear(), nowD.getUTCMonth(), 1);
  const monthStartTs = Math.floor(monthStartUtcMs / 1000);
  const monthStartIso = new Date(monthStartUtcMs).toISOString();

  // inquiries this month — customers:view
  let inquiriesThisMonthEnv: KpiEnvelope<number | null>;
  if (checkPermission(user, "customers", "view")) {
    try {
      const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inquiries WHERE created_at >= ?")
        .bind(monthStartIso)
        .first<{ c: number }>();
      inquiriesThisMonthEnv = countEnv("inquiries", r?.c);
    } catch (e) {
      // S14: 表缺失/查询失败 = ERROR，不再静默塌缩成 null（≈无数据/无权限）
      inquiriesThisMonthEnv = errEnv("inquiries", e);
    }
  } else {
    inquiriesThisMonthEnv = noPerm("inquiries");
  }

  // order total this month — commerce:view
  let ordersThisMonthEnv: KpiEnvelope<number | null>;
  if (checkPermission(user, "commerce", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COALESCE(SUM(total), 0) AS s FROM commerce_orders WHERE created_at >= ?",
      )
        .bind(monthStartTs)
        .first<{ s: number }>();
      ordersThisMonthEnv = countEnv("commerce_orders", r?.s);
    } catch (e) {
      ordersThisMonthEnv = errEnv("commerce_orders", e);
    }
  } else {
    ordersThisMonthEnv = noPerm("commerce_orders");
  }

  // site users — no data source; NO_DATA (structural), value null (frontend shows —)
  const siteUsersEnv: KpiEnvelope<number | null> = {
    value: null,
    state: "NO_DATA",
    source: "none",
    error: "No connected analytics source for site users",
  };

  // AI completed this month — ai:view
  let aiCompletedEnv: KpiEnvelope<number | null>;
  if (checkPermission(user, "ai", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM ai_missions WHERE status = 'completed' AND completed_at >= ?",
      )
        .bind(monthStartTs)
        .first<{ c: number }>();
      aiCompletedEnv = countEnv("ai_missions", r?.c);
    } catch (e) {
      aiCompletedEnv = errEnv("ai_missions", e);
    }
  } else {
    aiCompletedEnv = noPerm("ai_missions");
  }

  // 运营总览 — content counts by type (content:view)
  let contentCountsEnv: KpiEnvelope<Record<string, number> | null>;
  if (checkPermission(user, "content", "view")) {
    try {
      const rows = await env.DB.prepare(
        `SELECT entity_type, COUNT(*) AS c FROM admin_entities WHERE status != 'deleted' GROUP BY entity_type`,
      ).all<{ entity_type: string; c: number }>();
      const counts: Record<string, number> = {};
      for (const r of rows.results) counts[r.entity_type] = r.c;
      contentCountsEnv = { value: counts, state: "HAS_DATA", source: "admin_entities" };
    } catch (e) {
      contentCountsEnv = errEnv<Record<string, number> | null>("admin_entities", e);
    }
  } else {
    contentCountsEnv = noPerm<Record<string, number> | null>("admin_entities");
  }

  // total inquiries (all time) — customers:view
  let totalInquiriesEnv: KpiEnvelope<number | null>;
  if (checkPermission(user, "customers", "view")) {
    try {
      const r = await env.DB.prepare("SELECT COUNT(*) AS c FROM inquiries").first<{ c: number }>();
      totalInquiriesEnv = countEnv("inquiries", r?.c);
    } catch (e) {
      totalInquiriesEnv = errEnv("inquiries", e);
    }
  } else {
    totalInquiriesEnv = noPerm("inquiries");
  }

  // active commerce products — commerce:view
  let commerceActiveEnv: KpiEnvelope<number | null>;
  if (checkPermission(user, "commerce", "view")) {
    try {
      const r = await env.DB.prepare(
        "SELECT COUNT(*) AS c FROM commerce_products WHERE status = 'active'",
      ).first<{ c: number }>();
      commerceActiveEnv = countEnv("commerce_products", r?.c);
    } catch (e) {
      commerceActiveEnv = errEnv("commerce_products", e);
    }
  } else {
    commerceActiveEnv = noPerm("commerce_products");
  }

  return new Response(
    JSON.stringify({
      success: true,
      data: {
        // 标量字段（向后兼容现有前端；值 = 对应信封 value）
        inquiriesThisMonth: inquiriesThisMonthEnv.value,
        ordersThisMonth: ordersThisMonthEnv.value,
        siteUsers: siteUsersEnv.value,
        aiCompleted: aiCompletedEnv.value,
        contentCounts: contentCountsEnv.value,
        totalInquiries: totalInquiriesEnv.value,
        commerceActive: commerceActiveEnv.value,
        // S14: 三态信封——ERROR/NO_PERMISSION/NO_DATA 可分，故障不再伪装成「无数据」
        envelopes: {
          inquiriesThisMonth: inquiriesThisMonthEnv,
          ordersThisMonth: ordersThisMonthEnv,
          siteUsers: siteUsersEnv,
          aiCompleted: aiCompletedEnv,
          contentCounts: contentCountsEnv,
          totalInquiries: totalInquiriesEnv,
          commerceActive: commerceActiveEnv,
        },
      },
      error: null,
      meta: null,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}
