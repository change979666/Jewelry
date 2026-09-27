import type { APIRoute } from 'astro';
import { getCommerce } from '../../../../../lib/commerce';

export const POST: APIRoute = async ({ request, locals }) => {
  const db = locals.runtime.env.DB;
  const commerce = getCommerce(db);
  const data = await request.json() as any;

  // Insert product
  const pId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO products (id, slug, title, short_description, status) 
    VALUES (?, ?, ?, ?, ?)
  `).bind(pId, data.slug || pId, data.title, data.short_description, 'active').run();

  // Insert variant
  const vId = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO product_variants (id, product_id, sku, price, currency, inventory_quantity)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(vId, pId, data.sku || vId, data.price || 14900, 'SAR', 100).run();

  return new Response(JSON.stringify({ success: true, id: pId }), { headers: { "Content-Type": "application/json" } });
};

export const GET: APIRoute = async ({ locals }) => {
  const db = locals.runtime.env.DB;
  const commerce = getCommerce(db);
  const products = await commerce.products.listProducts();
  
  return new Response(JSON.stringify({ success: true, data: products }), { headers: { "Content-Type": "application/json" } });
};
