import type { APIRoute } from 'astro';

export const GET: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (id) {
    const order = await db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(id).first();
    const items = await db.prepare(`SELECT * FROM order_items WHERE order_id = ?`).bind(id).all();
    const events = await db.prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC`).bind(id).all();

    return new Response(JSON.stringify({
      success: true,
      data: { order, items: items.results, events: events.results }
    }), { headers: { "Content-Type": "application/json" } });
  }

  const { results } = await db.prepare(`
    SELECT o.id, o.order_number, o.order_status as status, o.total_amount as total, o.created_at,
           c.first_name || ' ' || c.last_name as customer_name, a.country
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN order_addresses a ON a.order_id = o.id AND a.type = 'shipping'
    ORDER BY o.created_at DESC
    LIMIT 20
  `).all();

  return new Response(JSON.stringify({
    success: true,
    data: results,
    meta: {
      total: results.length,
      page: 1,
      totalPages: 1,
      kpis: { total_orders: results.length, total_revenue: results.reduce((sum, r) => sum + r.total, 0) / 100 }
    }
  }), { headers: { "Content-Type": "application/json" } });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const { id, status } = await request.json() as any;

  await db.prepare(`UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
    .bind(status, id).run();
  
  await db.prepare(`INSERT INTO order_events (id, order_id, status, description) VALUES (?, ?, ?, ?)`)
    .bind(crypto.randomUUID(), id, status, "Status updated by admin").run();

  return new Response(JSON.stringify({ success: true }));
};
