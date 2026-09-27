// Jewelry V1.0 — Dashboard KPI（Jewelry schema only）
// GET /api/admin/v2/dashboard/kpi
// 全部指标来自 orders / products / customers / reviews；金额一律 minor units。
// 时间口径：UTC ISO 字符串字典序比较（created_at 全为 UTC ISO 格式）。

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function ok(data: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function dayStartISO(d: Date): string {
  return d.toISOString().slice(0, 10) + "T00:00:00.000Z";
}
function monthStartISO(d: Date): string {
  return d.toISOString().slice(0, 7) + "-01T00:00:00.000Z";
}

async function handlerAll({ request, env }: PagesCtx): Promise<Response> {
  const user = await authenticateRequest(request, env);
  const err = requirePermission(user, "commerce", "view");
  if (err) return err;

  const db = env.DB!;
  const now = new Date();
  const todayStart = dayStartISO(now);
  const tomorrowStart = dayStartISO(new Date(now.getTime() + 86400000));
  const monthStart = monthStartISO(now);
  const validOrder = "order_status NOT IN ('CANCELLED','REFUNDED')";

  const [
    todayRow,
    monthRow,
    todayMarketRows,
    monthMarketRows,
    pendingRow,
    productRow,
    lowStockRow,
    customerRow,
    reviewRow,
    statusRows,
  ] = await Promise.all([
    db
      .prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE ${validOrder} AND created_at >= ? AND created_at < ?`,
      )
      .bind(todayStart, tomorrowStart)
      .first<{ orders: number; revenue: number }>(),
    db
      .prepare(
        `SELECT COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE ${validOrder} AND created_at >= ?`,
      )
      .bind(monthStart)
      .first<{ orders: number; revenue: number }>(),
    db
      .prepare(
        `SELECT market, currency, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE ${validOrder} AND created_at >= ? AND created_at < ?
         GROUP BY market, currency`,
      )
      .bind(todayStart, tomorrowStart)
      .all<{ market: string; currency: string; orders: number; revenue: number }>(),
    db
      .prepare(
        `SELECT market, currency, COUNT(*) AS orders, COALESCE(SUM(total_amount),0) AS revenue
         FROM orders WHERE ${validOrder} AND created_at >= ?
         GROUP BY market, currency`,
      )
      .bind(monthStart)
      .all<{ market: string; currency: string; orders: number; revenue: number }>(),
    db
      .prepare(`SELECT COUNT(*) AS c FROM orders WHERE order_status = 'PENDING_CONFIRMATION'`)
      .first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM products WHERE status = 'active'`).first<{ c: number }>(),
    // 低库存：active 商品下所有变体总库存 < 5
    db
      .prepare(
        `SELECT COUNT(*) AS c FROM (
           SELECT p.id FROM products p
           JOIN product_variants v ON v.product_id = p.id AND v.status = 'active'
           WHERE p.status = 'active'
           GROUP BY p.id
           HAVING SUM(COALESCE(v.inventory_quantity, 0)) < 5
         )`,
      )
      .first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM customers`).first<{ c: number }>(),
    db.prepare(`SELECT COUNT(*) AS c FROM reviews WHERE status = 'pending'`).first<{ c: number }>(),
    db
      .prepare(`SELECT order_status AS s, COUNT(*) AS c FROM orders GROUP BY order_status`)
      .all<{ s: string; c: number }>(),
  ]);

  const statusCounts: Record<string, number> = {};
  for (const r of statusRows.results || []) statusCounts[r.s] = r.c;

  return ok({
    ordersToday: todayRow?.orders ?? 0,
    revenueToday: todayRow?.revenue ?? 0,
    ordersThisMonth: monthRow?.orders ?? 0,
    revenueThisMonth: monthRow?.revenue ?? 0,
    // 分市场收入（minor units，按币种分开，禁止跨币种加总）
    revenueTodayByMarket: todayMarketRows.results || [],
    revenueThisMonthByMarket: monthMarketRows.results || [],
    pendingConfirmation: pendingRow?.c ?? 0,
    activeProducts: productRow?.c ?? 0,
    lowStock: lowStockRow?.c ?? 0,
    totalCustomers: customerRow?.c ?? 0,
    pendingReviews: reviewRow?.c ?? 0,
    statusCounts,
  });
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
