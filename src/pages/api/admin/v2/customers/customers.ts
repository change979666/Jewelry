// Jewelry Admin V2 — Customers API (Customer 360)
// GET    /api/admin/v2/customers/customers  — list with search/pagination, or ?id= for detail
// POST   /api/admin/v2/customers/customers  — create or update customer
// DELETE /api/admin/v2/customers/customers  — delete customer
//
// NOTE: this file was ported from the legacy Aromiso schema (name / company /
// country / whatsapp / industry / lead_score / status / tags / deleted_at plus
// the `inquiries` and `oem_projects` tables). None of those exist in the Jewelry
// Commerce Core schema, so every request used to fail with "no such table".
// It now targets the real `customers` / `customer_addresses` / `orders` tables.
// Customer 360 for Jewelry = profile + order history + saved addresses.

import { authenticateRequest, requirePermission } from "@/lib/admin/rbac";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

/** Columns that may be written by the admin UI. */
const WRITABLE_FIELDS = ["email", "phone", "first_name", "last_name", "locale", "market"] as const;

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Keep only defined, non-object writable fields from the request body. */
function pickWritable(body: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of WRITABLE_FIELDS) {
    if (body[field] !== undefined) out[field] = body[field];
  }
  return out;
}

async function handlerAll(context: PagesCtx): Promise<Response> {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "Database unavailable" }, 500);

  const permErr = requirePermission(user, "customers", "view");
  if (permErr) return permErr;

  const url = new URL(request.url);

  // ---- GET: detail (?id=) or paginated list --------------------------------
  if (request.method === "GET") {
    const id = url.searchParams.get("id");

    if (id) {
      const customer = await env.DB.prepare("SELECT * FROM customers WHERE id = ?").bind(id).first();
      if (!customer) return json({ error: "Customer not found" }, 404);

      const orders = await env.DB.prepare(
        "SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 50",
      )
        .bind(id)
        .all();

      const addresses = await env.DB.prepare(
        "SELECT * FROM customer_addresses WHERE customer_id = ? ORDER BY created_at DESC",
      )
        .bind(id)
        .all();

      return json({
        ok: true,
        data: { ...customer, orders: orders.results, addresses: addresses.results },
      });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const search = url.searchParams.get("search")?.trim() || "";
    const offset = (page - 1) * limit;

    const clauses: string[] = [];
    const params: unknown[] = [];

    if (search) {
      clauses.push("(first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";

    const countResult = await env.DB.prepare(`SELECT COUNT(*) as total FROM customers ${where}`)
      .bind(...params)
      .first<{ total: number }>();
    const total = countResult?.total || 0;

    const { results } = await env.DB.prepare(
      `SELECT * FROM customers ${where} ORDER BY updated_at DESC LIMIT ? OFFSET ?`,
    )
      .bind(...params, limit, offset)
      .all();

    return json({
      ok: true,
      data: results,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  }

  // ---- POST: create or update ----------------------------------------------
  if (request.method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }

    const id = body.id as string | undefined;
    // Updating an existing profile only needs edit access. Requiring create
    // here made editor-role users unable to save changes from the customer list.
    const permErr2 = requirePermission(user, "customers", id ? "edit" : "create");
    if (permErr2) return permErr2;

    const now = new Date().toISOString();
    const fields = pickWritable(body);

    if (id) {
      const existing = await env.DB.prepare("SELECT id FROM customers WHERE id = ?")
        .bind(id)
        .first();
      if (!existing) return json({ error: "Customer not found" }, 404);

      const sets: string[] = ["updated_at = ?"];
      const vals: unknown[] = [now];
      for (const [key, value] of Object.entries(fields)) {
        sets.push(`${key} = ?`);
        vals.push(value);
      }
      vals.push(id);

      await env.DB.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...vals)
        .run();
      return json({ ok: true, id });
    }

    // Create
    const newId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const cols = ["id", ...Object.keys(fields), "created_at", "updated_at"];
    const placeholders = cols.map(() => "?").join(", ");
    const vals = [newId, ...Object.values(fields), now, now];

    try {
      await env.DB.prepare(`INSERT INTO customers (${cols.join(", ")}) VALUES (${placeholders})`)
        .bind(...vals)
        .run();
    } catch (err) {
      // email is UNIQUE — surface a clean 409 instead of a 500.
      const message = err instanceof Error ? err.message : String(err);
      if (/UNIQUE/i.test(message)) return json({ error: "A customer with that email already exists" }, 409);
      throw err;
    }

    return json({ ok: true, id: newId });
  }

  // ---- DELETE --------------------------------------------------------------
  // The Jewelry schema has no soft-delete columns on `customers`; this is a
  // real delete. Orders keep their `customer_id` reference, so a customer with
  // order history is rejected with 409 rather than orphaning that history.
  if (request.method === "DELETE") {
    const permErr3 = requirePermission(user, "customers", "delete");
    if (permErr3) return permErr3;

    let body: { id?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!body.id) return json({ error: "Missing id" }, 422);

    const orderCount = await env.DB.prepare(
      "SELECT COUNT(*) as total FROM orders WHERE customer_id = ?",
    )
      .bind(body.id)
      .first<{ total: number }>();
    if ((orderCount?.total ?? 0) > 0) {
      return json({ error: "Customer has order history and cannot be deleted" }, 409);
    }

    const res = await env.DB.prepare("DELETE FROM customers WHERE id = ?").bind(body.id).run();
    if (!res.meta.changes) return json({ error: "Customer not found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const ALL = endpoint(handlerAll);
