// Phase 6 — V2 Customers API (Customer 360)
// GET    /api/admin/v2/customers/customers  — list with search/filter/pagination
// POST   /api/admin/v2/customers/customers  — create or update customer
// DELETE /api/admin/v2/customers/customers  — soft delete

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequest(context: { request: Request; env: AdminEnv }) {
  const { request, env } = context;
  const user = await authenticateRequest(request, env);
  if (!user) return json({ error: "Unauthorized" }, 401);
  if (!env.DB) return json({ error: "Database unavailable" }, 500);

  const permErr = requirePermission(user, "customers", "view");
  if (permErr) return permErr;

  const url = new URL(request.url);

  if (request.method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const customer = await env.DB.prepare(
        "SELECT * FROM customers WHERE id = ? AND deleted_at IS NULL",
      )
        .bind(id)
        .first();
      if (!customer) return json({ error: "Customer not found" }, 404);
      const inquiries = await env.DB.prepare(
        "SELECT * FROM inquiries WHERE customer_id = ? ORDER BY created_at DESC",
      )
        .bind(id)
        .all();
      const orders = await env.DB.prepare(
        "SELECT * FROM commerce_orders WHERE email = ? ORDER BY created_at DESC LIMIT 50",
      )
        .bind((customer as Record<string, unknown>).email)
        .all();
      const oemProjects = await env.DB.prepare(
        "SELECT * FROM oem_projects WHERE customer_id = ? AND deleted_at IS NULL ORDER BY created_at DESC",
      )
        .bind(id)
        .all();
      return json({
        ok: true,
        data: {
          ...customer,
          inquiries: inquiries.results,
          orders: orders.results,
          oem_projects: oemProjects.results,
        },
      });
    }

    const page = Math.max(1, parseInt(url.searchParams.get("page") || "1"));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get("limit") || "20")));
    const search = url.searchParams.get("search")?.trim() || "";
    const status = url.searchParams.get("status") || "";
    const offset = (page - 1) * limit;

    const clauses: string[] = ["deleted_at IS NULL"];
    const params: unknown[] = [];

    if (status) {
      clauses.push("status = ?");
      params.push(status);
    }
    if (search) {
      clauses.push("(name LIKE ? OR email LIKE ? OR company LIKE ? OR country LIKE ?)");
      const s = `%${search}%`;
      params.push(s, s, s, s);
    }

    const where = `WHERE ${clauses.join(" AND ")}`;
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

    if (id) {
      const existing = await env.DB.prepare(
        "SELECT id FROM customers WHERE id = ? AND deleted_at IS NULL",
      )
        .bind(id)
        .first();
      if (!existing) return json({ error: "Customer not found" }, 404);
      const fields = [
        "name",
        "email",
        "company",
        "country",
        "whatsapp",
        "phone",
        "industry",
        "website",
        "notes",
        "lead_score",
        "status",
        "tags",
      ];
      const sets: string[] = ["updated_at = ?"];
      const vals: unknown[] = [now];
      for (const f of fields) {
        if (body[f] !== undefined) {
          sets.push(`${f} = ?`);
          vals.push(typeof body[f] === "object" ? JSON.stringify(body[f]) : body[f]);
        }
      }
      vals.push(id);
      await env.DB.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`)
        .bind(...vals)
        .run();
      return json({ ok: true, id });
    }

    // Create
    const newId = `cust_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const name = (body.name as string) || "";
    const email = (body.email as string) || "";
    const company = (body.company as string) || "";
    const country = (body.country as string) || "";
    const whatsapp = (body.whatsapp as string) || "";
    const phone = (body.phone as string) || "";
    const industry = (body.industry as string) || "";
    const website = (body.website as string) || "";
    const notes = (body.notes as string) || "";
    const lead_score = (body.lead_score as number) || 0;
    const status = (body.status as string) || "active";
    const source = (body.source as string) || "";
    const tags = JSON.stringify(body.tags || []);

    await env.DB.prepare(
      "INSERT INTO customers (id, name, email, company, country, whatsapp, phone, industry, website, notes, lead_score, status, source, tags, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
      .bind(
        newId,
        name,
        email,
        company,
        country,
        whatsapp,
        phone,
        industry,
        website,
        notes,
        lead_score,
        status,
        source,
        tags,
        now,
        now,
      )
      .run();

    return json({ ok: true, id: newId });
  }

  if (request.method === "DELETE") {
    const permErr2 = requirePermission(user, "customers", "delete");
    if (permErr2) return permErr2;

    let body: { id?: string };
    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON" }, 400);
    }
    if (!body.id) return json({ error: "Missing id" }, 422);

    const res = await env.DB.prepare(
      "UPDATE customers SET deleted_at = datetime('now'), deleted_by = ? WHERE id = ? AND deleted_at IS NULL",
    )
      .bind(user.id, body.id)
      .run();
    if (!res.meta.changes) return json({ error: "Customer not found" }, 404);
    return json({ ok: true });
  }

  return json({ error: "Method not allowed" }, 405);
}
