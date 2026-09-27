// ---------------------------------------------------------------------------
//  Jewelry Commerce — Public Reviews API (Jewelry `reviews` table)
//  GET  /api/commerce/reviews?product_id=x  → approved reviews + rating summary
//  POST /api/commerce/reviews               → submit a review (pending, rate-limited)
// ---------------------------------------------------------------------------

import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

async function handlerGet({ request, env }: PagesCtx): Promise<Response> {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  const url = new URL(request.url);
  const productId = (url.searchParams.get("product_id") || "").trim();
  if (!productId) return json({ ok: false, error: "product_id is required" }, 400);

  try {
    const reviews = await db
      .prepare(
        `SELECT id, rating, title, content, verified_purchase, locale, created_at
         FROM reviews WHERE product_id = ? AND status = 'approved'
         ORDER BY created_at DESC LIMIT 20`,
      )
      .bind(productId)
      .all();
    const stats = await db
      .prepare(`SELECT AVG(rating) AS avg_rating, COUNT(*) AS total FROM reviews WHERE product_id = ? AND status = 'approved'`)
      .bind(productId)
      .first<{ avg_rating: number | null; total: number }>();

    return json({
      ok: true,
      reviews: reviews.results || [],
      average_rating: stats?.avg_rating ? Math.round(stats.avg_rating * 10) / 10 : 0,
      total: stats?.total ?? 0,
    });
  } catch (err) {
    return json({ ok: false, error: "reviews_error", detail: String(err) }, 500);
  }
};

async function handlerPost({ request, env }: PagesCtx): Promise<Response> {
  const db = env.DB;
  const kv = env.DRAFTS;
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  // Rate limit: 5 review submissions per IP per hour
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  if (kv) {
    const rlKey = `rl:review:${ip}`;
    const count = Number((await kv.get(rlKey)) || "0");
    if (count >= 5) return json({ ok: false, error: "Too many requests" }, 429);
    await kv.put(rlKey, String(count + 1), { expirationTtl: 3600 });
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const productId = String(body.product_id || "").trim();
  const orderId = String(body.order_id || "").trim();
  const reviewerName = String(body.reviewer_name || "").trim().slice(0, 200);
  const reviewerEmail = String(body.reviewer_email || "").trim().slice(0, 200).toLowerCase();
  const rating = Math.floor(Number(body.rating) || 0);
  const title = String(body.title || "").trim().slice(0, 300);
  const content = String(body.content || "").trim().slice(0, 5000);
  const locale = String(body.locale || "").trim().slice(0, 10) || null;

  if (!productId) return json({ ok: false, error: "product_id is required" }, 422);
  if (rating < 1 || rating > 5) return json({ ok: false, error: "rating must be 1-5" }, 422);
  if (content.length < 10) return json({ ok: false, error: "content too short" }, 422);
  if (!reviewerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail))
    return json({ ok: false, error: "Valid reviewer_email is required" }, 422);

  try {
    const product = await db.prepare(`SELECT id FROM products WHERE id = ?`).bind(productId).first();
    if (!product) return json({ ok: false, error: "Unknown product" }, 422);

    // verified_purchase only when the reviewer email owns a delivered order containing the product
    let verified = 0;
    if (orderId) {
      const row = await db
        .prepare(
          `SELECT 1 AS ok FROM orders o
           JOIN customers c ON c.id = o.customer_id
           JOIN order_items oi ON oi.order_id = o.id AND oi.product_id = ?
           WHERE o.id = ? AND lower(c.email) = ? AND o.order_status = 'DELIVERED'
           LIMIT 1`,
        )
        .bind(productId, orderId, reviewerEmail)
        .first();
      if (row) verified = 1;
    }

    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO reviews (id, product_id, order_id, rating, title, content, status, verified_purchase, locale)
         VALUES (?,?,?,?,?,?, 'pending', ?, ?)`,
      )
      .bind(id, productId, orderId || null, rating, title || null, content, verified, locale)
      .run();

    return json({ ok: true, id, status: "pending" }, 201);
  } catch (err) {
    return json({ ok: false, error: "review_create_failed", detail: String(err) }, 500);
  }
};

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const GET = endpoint(handlerGet);
export const POST = endpoint(handlerPost);
