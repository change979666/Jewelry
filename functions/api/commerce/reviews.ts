// ---------------------------------------------------------------------------
//  Aromiso Commerce — Public Reviews API
//  GET  /api/commerce/reviews?product_id=x  → approved reviews for a product
//  POST /api/commerce/reviews               → submit a new review (pending)
// ---------------------------------------------------------------------------

import type { Env } from "../../types";

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  const url = new URL(request.url);
  const productId = url.searchParams.get("product_id");

  if (!productId) return json({ error: "product_id is required" }, 400);

  try {
    const reviews = await db
      .prepare(
        "SELECT id, product_id, reviewer_name, country, rating, title, content, verified_buyer, created_at FROM commerce_product_reviews WHERE product_id = ? AND status = 'approved' ORDER BY created_at DESC LIMIT 20",
      )
      .bind(productId)
      .all<Record<string, unknown>>();

    const stats = await db
      .prepare(
        "SELECT AVG(rating) as average_rating, COUNT(*) as total FROM commerce_product_reviews WHERE product_id = ? AND status = 'approved'",
      )
      .bind(productId)
      .first<{ average_rating: number | null; total: number }>();

    const averageRating = stats?.average_rating ? Math.round(stats.average_rating * 10) / 10 : 0;

    return json({
      ok: true,
      reviews: reviews.results,
      average_rating: averageRating,
      total: stats?.total ?? 0,
    });
  } catch (err) {
    return json({ error: "Internal error", detail: String(err) }, 500);
  }
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  // Parse body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  // Extract and sanitize fields
  const productId = String(body.product_id || "").trim();
  const orderId = String(body.order_id || "").trim();
  const reviewerName = String(body.reviewer_name || "")
    .trim()
    .slice(0, 200);
  const reviewerEmail = String(body.reviewer_email || "")
    .trim()
    .slice(0, 200);
  const country = String(body.country || "")
    .trim()
    .slice(0, 100);
  const rating = Math.floor(Number(body.rating) || 0);
  const title = String(body.title || "")
    .trim()
    .slice(0, 300);
  const content = String(body.content || "")
    .trim()
    .slice(0, 5000);

  // Validation
  if (!productId) return json({ error: "product_id is required" }, 422);
  if (rating < 1 || rating > 5) return json({ error: "rating must be between 1 and 5" }, 422);
  if (content.length < 10) return json({ error: "content must be at least 10 characters" }, 422);
  if (!reviewerEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reviewerEmail))
    return json({ error: "Valid reviewer_email is required" }, 422);

  try {
    // S37：product 必须真实存在——杜绝孤儿评论（指向不存在商品的评论）。
    const product = await db
      .prepare("SELECT id FROM commerce_products WHERE id = ?")
      .bind(productId)
      .first<{ id: string }>();
    if (!product) {
      return json({ error: "product_id does not reference an existing product" }, 422);
    }

    // S37：verified_buyer 必须基于真实购买——订单已完成、属于该评论者（邮箱匹配）、
    // 且确实包含该商品。仅凭「任意已完成订单 id」不得授予 verified 徽章（防伪）。
    let verifiedBuyer = 0;
    if (orderId) {
      const order = await db
        .prepare("SELECT id, email FROM commerce_orders WHERE id = ? AND status = 'completed'")
        .bind(orderId)
        .first<{ id: string; email: string | null }>();
      const belongsToReviewer =
        !!order && (order.email || "").toLowerCase() === reviewerEmail.toLowerCase();
      if (belongsToReviewer) {
        const item = await db
          .prepare(
            "SELECT 1 AS ok FROM commerce_order_items WHERE order_id = ? AND product_id = ? LIMIT 1",
          )
          .bind(orderId, productId)
          .first<{ ok: number }>();
        if (item) verifiedBuyer = 1;
      }
    }

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);

    await db
      .prepare(
        `INSERT INTO commerce_product_reviews (id, product_id, order_id, reviewer_name, reviewer_email, country, rating, title, content, status, verified_buyer, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
      )
      .bind(
        id,
        productId,
        orderId || null,
        reviewerName,
        reviewerEmail,
        country,
        rating,
        title,
        content,
        verifiedBuyer,
        now,
      )
      .run();

    return json({ ok: true, id }, 201);
  } catch (err) {
    return json({ error: "Failed to create review", detail: String(err) }, 500);
  }
};
