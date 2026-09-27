// Phase 5 — V2 Commerce Orders API
// GET    /api/admin/v2/commerce/orders      → list orders (search/filter/sort/paginate)
// GET    /api/admin/v2/commerce/orders?id=x → order detail + items + events
// POST   /api/admin/v2/commerce/orders      → update order (status/shipping/note)

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";

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

const VALID_STATUSES = [
  "new",
  "reviewing",
  "quoted",
  "paid",
  "processing",
  "shipped",
  "completed",
  "cancelled",
];

export const onRequest: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const user = await authenticateRequest(request, env);
  const err = requirePermission(user, "commerce", "view");
  if (err) return err;

  const db = env.DB!;
  const url = new URL(request.url);
  const method = request.method;

  if (method === "GET") {
    const id = url.searchParams.get("id");

    if (id) {
      const order = await db
        .prepare("SELECT * FROM commerce_orders WHERE id = ?")
        .bind(id)
        .first<Record<string, unknown>>();
      if (!order) return fail("NOT_FOUND", "Order not found", 404);

      const items = await db
        .prepare("SELECT * FROM commerce_order_items WHERE order_id = ? ORDER BY created_at")
        .bind(id)
        .all();
      const events = await db
        .prepare("SELECT * FROM commerce_order_events WHERE order_id = ? ORDER BY created_at")
        .bind(id)
        .all();

      return ok({ order, items: items.results, events: events.results });
    }

    // List
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const offset = (page - 1) * pageSize;
    const status = url.searchParams.get("status") || "";
    const country = url.searchParams.get("country") || "";
    const search = url.searchParams.get("search") || "";
    const sort = url.searchParams.get("sort") || "created_at";
    const order = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";

    const allowedSorts: Record<string, string> = {
      created_at: "created_at",
      updated_at: "updated_at",
      total: "total",
      status: "status",
      order_number: "order_number",
    };
    const sortCol = allowedSorts[sort] || "created_at";

    let query = "SELECT * FROM commerce_orders WHERE 1=1";
    const params: (string | number)[] = [];

    if (status && VALID_STATUSES.includes(status)) {
      query += " AND status = ?";
      params.push(status);
    }
    if (country) {
      query += " AND country = ?";
      params.push(country);
    }
    if (search) {
      query +=
        " AND (customer_name LIKE ? OR company LIKE ? OR email LIKE ? OR order_number LIKE ?)";
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const countRow = params.length
      ? await db
          .prepare(countQuery)
          .bind(...params)
          .first<{ total: number }>()
      : await db.prepare(countQuery).first<{ total: number }>();
    const total = countRow?.total || 0;

    // Status counts
    const statusRows = await db
      .prepare("SELECT status, COUNT(*) AS c FROM commerce_orders GROUP BY status")
      .all<{ status: string; c: number }>();
    const statusCounts: Record<string, number> = {};
    for (const row of statusRows.results) statusCounts[row.status] = row.c;

    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);
    const orders = await db
      .prepare(query)
      .bind(...params)
      .all();

    // KPIs
    const kpis = await db
      .prepare(
        "SELECT COUNT(*) as total_orders, COALESCE(SUM(total), 0) as total_revenue, COALESCE(AVG(total), 0) as avg_order_value FROM commerce_orders WHERE status NOT IN ('cancelled')",
      )
      .first<{ total_orders: number; total_revenue: number; avg_order_value: number }>();

    return ok(orders.results, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      statusCounts,
      kpis,
    });
  }

  if (method === "POST") {
    const errEdit = requirePermission(user, "commerce", "edit");
    if (errEdit) return errEdit;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_ERROR", "Invalid JSON", 400);
    }

    const orderId = String(body.id || "").trim();
    if (!orderId) return fail("VALIDATION_ERROR", "Order ID required", 422);

    const order = await db
      .prepare("SELECT id, status, subtotal, shipping_cost FROM commerce_orders WHERE id = ?")
      .bind(orderId)
      .first<{ id: string; status: string; subtotal: number; shipping_cost: number | null }>();
    if (!order) return fail("NOT_FOUND", "Order not found", 404);

    const newStatus = String(body.status || "")
      .trim()
      .toLowerCase();
    const shippingCost =
      body.shipping_cost !== undefined && body.shipping_cost !== null
        ? Number(body.shipping_cost)
        : undefined;
    const adminNote =
      body.admin_note !== undefined ? String(body.admin_note).trim().slice(0, 2000) : undefined;

    if (!newStatus && shippingCost === undefined && adminNote === undefined)
      return fail("VALIDATION_ERROR", "Nothing to update", 422);
    if (newStatus && !VALID_STATUSES.includes(newStatus))
      return fail("VALIDATION_ERROR", `Invalid status. Valid: ${VALID_STATUSES.join(", ")}`, 422);

    const now = Math.floor(Date.now() / 1000);
    const updates: string[] = ["updated_at = ?"];
    const updateParams: (string | number)[] = [now];

    if (newStatus && newStatus !== order.status) {
      updates.push("status = ?");
      updateParams.push(newStatus);
    }
    if (shippingCost !== undefined && !isNaN(shippingCost) && shippingCost >= 0) {
      updates.push("shipping_cost = ?");
      updateParams.push(shippingCost);
      const newTotal = Math.round((order.subtotal + shippingCost) * 100) / 100;
      updates.push("total = ?");
      updateParams.push(newTotal);
    }
    if (adminNote !== undefined) {
      updates.push("admin_note = ?");
      updateParams.push(adminNote);
    }

    updateParams.push(orderId);
    await db
      .prepare(`UPDATE commerce_orders SET ${updates.join(", ")} WHERE id = ?`)
      .bind(...updateParams)
      .run();

    // Record status change event
    if (newStatus && newStatus !== order.status) {
      const eventId = crypto.randomUUID();
      const note = String(body.note || "")
        .trim()
        .slice(0, 500);
      await db
        .prepare(
          "INSERT INTO commerce_order_events (id, order_id, from_status, to_status, note, created_by, created_at) VALUES (?,?,?,?,?,?,?)",
        )
        .bind(
          eventId,
          orderId,
          order.status,
          newStatus,
          note || `Status changed to ${newStatus}`,
          user!.username,
          now,
        )
        .run();
    }

    return ok({ id: orderId, updated: true });
  }

  return fail("VALIDATION_ERROR", "Method not allowed", 405);
};
