// Jewelry V1.0 — Admin Orders API (Jewelry schema only, state machine enforced)
// GET    /api/admin/v2/commerce/orders            → list (status/search/sort/paginate + KPIs)
// GET    /api/admin/v2/commerce/orders?id=x       → detail (items/events/address/shipments/legal transitions)
// POST   /api/admin/v2/commerce/orders            → { id, status, reason } legal transition only
//
// 金额一律 minor units（integer），由前端按 currency 格式化；旧版状态
// （new/reviewing/quoted/paid/...）已彻底移除，任何业务状态变更必须经过
// OrderService.updateOrderStatus（状态机），直接 UPDATE orders SET order_status
// 在业务链路中禁止。

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import {
  OrderService,
  canTransition,
  ORDER_TRANSITIONS,
} from "@/lib/commerce/order.service";
import type { OrderStatus } from "@/lib/commerce/types";
import { logAction } from "@/lib/admin/audit";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function ok(data: unknown, meta?: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: meta || null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

const STATUSES = Object.keys(ORDER_TRANSITIONS);

const SORT_WHITELIST: Record<string, string> = {
  created_at: "o.created_at",
  total_amount: "o.total_amount",
  order_number: "o.order_number",
  order_status: "o.order_status",
};

async function handlerAll({ request, env }: PagesCtx): Promise<Response> {
  const user = await authenticateRequest(request, env);
  const err = requirePermission(user, "commerce", "view");
  if (err) return err;

  const db = env.DB!;
  const orders = new OrderService(db);
  const url = new URL(request.url);
  const method = request.method;

  // ---- GET: detail or list ----
  if (method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const order = await orders.getOrder(id);
      if (!order) return fail("NOT_FOUND", "Order not found", 404);
      const [items, events, address, shipments] = await Promise.all([
        orders.getOrderItems(id),
        orders.getOrderEvents(id),
        orders.getOrderAddress(id),
        orders.getShipments(id),
      ]);
      const current = order.order_status as OrderStatus;
      return ok({
        order,
        items,
        events,
        address,
        shipments,
        // 合法下一步：状态机唯一事实源，UI 不得渲染非法跳转按钮。
        legalTransitions: ORDER_TRANSITIONS[current] ?? [],
        allStatuses: STATUSES,
      });
    }

    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const offset = (page - 1) * pageSize;
    const status = url.searchParams.get("status") || "";
    const search = (url.searchParams.get("search") || "").trim();
    const sortCol = SORT_WHITELIST[url.searchParams.get("sort") || "created_at"] ?? "o.created_at";
    const sortDir = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";

    const where: string[] = [];
    const params: (string | number)[] = [];
    if (status) {
      if (!STATUSES.includes(status)) return fail("VALIDATION_ERROR", "Unknown status", 422);
      where.push("o.order_status = ?");
      params.push(status);
    }
    if (search) {
      // 防 LIKE 通配符注入：剥离 % 与 _
      const q = `%${search.replace(/[\\%_]/g, "")}%`;
      where.push("(o.order_number LIKE ? OR a.phone LIKE ? OR c.email LIKE ?)");
      params.push(q, q, q);
    }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const baseFrom = `FROM orders o
      LEFT JOIN customers c ON c.id = o.customer_id
      LEFT JOIN order_addresses a ON a.order_id = o.id AND a.type = 'shipping'`;

    const countRow = await db
      .prepare(`SELECT COUNT(*) AS total ${baseFrom} ${whereSql}`)
      .bind(...params)
      .first<{ total: number }>();
    const total = countRow?.total || 0;

    const { results } = await db
      .prepare(
        `SELECT o.id, o.order_number, o.order_status, o.payment_status, o.fulfillment_status,
                o.market, o.currency, o.subtotal, o.discount_amount, o.shipping_amount,
                o.tax_amount, o.total_amount, o.created_at,
                c.email AS customer_email,
                a.first_name, a.last_name, a.phone, a.country
         ${baseFrom} ${whereSql}
         ORDER BY ${sortCol} ${sortDir} LIMIT ? OFFSET ?`,
      )
      .bind(...params, pageSize, offset)
      .all();

    // 状态分布 + KPI（与当前过滤条件无关的全量口径）
    const [statusRows, kpiRow] = await Promise.all([
      db
        .prepare("SELECT order_status AS s, COUNT(*) AS c FROM orders GROUP BY order_status")
        .all<{ s: string; c: number }>(),
      db
        .prepare(
          `SELECT COUNT(*) AS total_orders, COALESCE(SUM(total_amount),0) AS total_revenue
           FROM orders WHERE order_status NOT IN ('CANCELLED','REFUNDED')`,
        )
        .first<{ total_orders: number; total_revenue: number }>(),
    ]);
    const statusCounts: Record<string, number> = {};
    for (const r of statusRows.results || []) statusCounts[r.s] = r.c;

    const totalOrders = kpiRow?.total_orders || 0;
    return ok(results || [], {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      statusCounts,
      kpis: {
        total_orders: totalOrders,
        total_revenue: kpiRow?.total_revenue || 0, // minor units
        avg_order_value: totalOrders > 0 ? Math.round((kpiRow?.total_revenue || 0) / totalOrders) : 0,
      },
    });
  }

  // ---- POST: legal status transition ----
  if (method === "POST") {
    const errEdit = requirePermission(user, "commerce", "edit");
    if (errEdit) return errEdit;

    let body: { id?: string; status?: string; reason?: string };
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_ERROR", "Invalid JSON", 400);
    }
    const { id, status, reason } = body;
    if (!id || !status) return fail("VALIDATION_ERROR", "id and status are required", 422);
    if (!STATUSES.includes(status)) return fail("VALIDATION_ERROR", "Unknown status", 422);

    const order = await orders.getOrder(id);
    if (!order) return fail("NOT_FOUND", "Order not found", 404);

    const to = status as OrderStatus;
    if (!canTransition(order.order_status as OrderStatus, to)) {
      return fail(
        "ILLEGAL_TRANSITION",
        `Cannot transition ${order.order_status} → ${to}`,
        409,
      );
    }

    const result = await orders.updateOrderStatus(id, to, reason, user!.username);
    if (!result.ok) return fail("TRANSITION_FAILED", result.error || "transition failed", 500);

    await logAction(env, {
      actor_type: "human",
      user_id: user!.id,
      username: user!.username,
      action: "order_status_transition",
      resource_type: "order",
      resource_id: id,
      change_summary: `${order.order_status} → ${to}${reason ? `: ${reason}` : ""}`,
    });

    const updated = await orders.getOrder(id);
    return ok({ order: updated });
  }

  return fail("METHOD_NOT_ALLOWED", "Method not allowed", 405);
};

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
