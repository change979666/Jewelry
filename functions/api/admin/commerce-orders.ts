// ---------------------------------------------------------------------------
//  Aromiso Commerce — Admin Orders API
//  GET   /api/admin/commerce-orders          → list orders (filters)
//  GET   /api/admin/commerce-orders?id=x     → order detail + items + events
//  POST  /api/admin/commerce-orders          → update status / shipping / note
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";

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

export const onRequest: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);

  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  const url = new URL(request.url);

  // ---- GET: list or detail ----
  if (request.method === "GET") {
    const id = url.searchParams.get("id");

    // Single order detail
    if (id) {
      const order = await db
        .prepare("SELECT * FROM commerce_orders WHERE id = ?")
        .bind(id)
        .first<Record<string, unknown>>();

      if (!order) return json({ error: "Order not found" }, 404);

      const items = await db
        .prepare("SELECT * FROM commerce_order_items WHERE order_id = ? ORDER BY created_at")
        .bind(id)
        .all<Record<string, unknown>>();

      const events = await db
        .prepare("SELECT * FROM commerce_order_events WHERE order_id = ? ORDER BY created_at")
        .bind(id)
        .all<Record<string, unknown>>();

      return json({ ok: true, order, items: items.results, events: events.results });
    }

    // Order list with filters
    const status = url.searchParams.get("status");
    const country = url.searchParams.get("country");
    const search = url.searchParams.get("search");
    const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
    const offset = Number(url.searchParams.get("offset")) || 0;

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

    // Count total
    const countQuery = query.replace("SELECT *", "SELECT COUNT(*) as total");
    const countRow = params.length
      ? await db
          .prepare(countQuery)
          .bind(...params)
          .first<{ total: number }>()
      : await db.prepare(countQuery).first<{ total: number }>();

    query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const orders = await db
      .prepare(query)
      .bind(...params)
      .all<Record<string, unknown>>();

    return json({ ok: true, orders: orders.results, total: countRow?.total ?? 0 });
  }

  // ---- POST: update order ----
  if (request.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const orderId = String(body.id || "").trim();
    if (!orderId) return json({ error: "Order ID required" }, 422);

    const order = await db
      .prepare("SELECT id, status, subtotal, shipping_cost FROM commerce_orders WHERE id = ?")
      .bind(orderId)
      .first<{ id: string; status: string; subtotal: number; shipping_cost: number | null }>();

    if (!order) return json({ error: "Order not found" }, 404);

    const newStatus = String(body.status || "")
      .trim()
      .toLowerCase();
    const shippingCost =
      body.shipping_cost !== undefined && body.shipping_cost !== null
        ? Number(body.shipping_cost)
        : undefined;
    const adminNote =
      body.admin_note !== undefined ? String(body.admin_note).trim().slice(0, 2000) : undefined;

    // Must change at least one field
    if (!newStatus && shippingCost === undefined && adminNote === undefined) {
      return json({ error: "Nothing to update" }, 422);
    }

    // Validate status transition
    if (newStatus && !VALID_STATUSES.includes(newStatus)) {
      return json({ error: `Invalid status. Valid: ${VALID_STATUSES.join(", ")}` }, 422);
    }

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
      // Recalculate total
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
          `INSERT INTO commerce_order_events (id, order_id, from_status, to_status, note, created_by, created_at)
           VALUES (?, ?, ?, ?, ?, 'admin', ?)`,
        )
        .bind(
          eventId,
          orderId,
          order.status,
          newStatus,
          note || `Status changed to ${newStatus}`,
          now,
        )
        .run();
    }

    return json({ ok: true, message: "Order updated" });
  }

  return json({ error: "Method not allowed" }, 405);
};
