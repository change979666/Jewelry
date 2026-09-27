// ---------------------------------------------------------------------------
//  Jewelry Commerce — Public Products API (Jewelry schema only)
//  GET /api/commerce/products                    → list active products
//  GET /api/commerce/products?slug=x             → single product detail
//  GET /api/commerce/products?collection=slug    → filter by collection
//  GET /api/commerce/products?q=term             → search title/sku/slug
//  GET /api/commerce/products?sort=newest|price_asc|price_desc|title
//  GET /api/commerce/products?meta=collections   → live collection facets
// ---------------------------------------------------------------------------

import type { Env } from "../../types";

function json(data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": status >= 500 ? "no-store" : "public, max-age=60",
      ...extraHeaders,
    },
  });
}

const SORT_WHITELIST = ["newest", "price_asc", "price_desc", "title"] as const;

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  const url = new URL(request.url);
  const slug = (url.searchParams.get("slug") || "").trim().slice(0, 200);
  const collection = (url.searchParams.get("collection") || "").trim().slice(0, 200);
  const meta = url.searchParams.get("meta") || "";

  const rawLimit = parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 24;
  const rawOffset = parseInt(url.searchParams.get("offset") || "", 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;
  const q = (url.searchParams.get("q") || "").trim().slice(0, 40);
  const sortRaw = url.searchParams.get("sort") || "newest";
  const sort = (SORT_WHITELIST as readonly string[]).includes(sortRaw) ? sortRaw : "newest";

  try {
    if (meta === "collections") {
      const rows = await db
        .prepare(
          `SELECT c.slug, c.name, COUNT(cp.product_id) AS n
           FROM collections c
           LEFT JOIN collection_products cp ON cp.collection_id = c.id
           LEFT JOIN products p ON p.id = cp.product_id AND p.status = 'active'
           WHERE c.status = 'active'
           GROUP BY c.id ORDER BY c.sort_order ASC, c.name ASC`,
        )
        .all<{ slug: string; name: string; n: number }>();
      return json({ ok: true, collections: rows.results || [] });
    }

    // ---- Single product detail ----
    if (slug) {
      const product = await db
        .prepare(`SELECT * FROM products WHERE slug = ? AND status = 'active'`)
        .bind(slug)
        .first<Record<string, unknown>>();
      if (!product) return json({ ok: false, error: "Product not found" }, 404);

      const variants = await db
        .prepare(`SELECT id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status FROM product_variants WHERE product_id = ? AND status = 'active' ORDER BY created_at ASC`)
        .bind(product.id as string)
        .all();
      const media = await db
        .prepare(`SELECT id, type, url, alt, sort_order FROM product_media WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC`)
        .bind(product.id as string)
        .all();

      return json({
        ok: true,
        product: { ...product, variants: variants.results, media: media.results },
      });
    }

    // ---- List ----
    let where = ` WHERE p.status = 'active'`;
    const params: (string | number)[] = [];

    if (collection) {
      where += ` AND p.id IN (SELECT cp.product_id FROM collection_products cp JOIN collections c ON c.id = cp.collection_id WHERE c.slug = ?)`;
      params.push(collection);
    }
    if (q) {
      const like = `%${q.replace(/[\\%_]/g, "")}%`;
      where += ` AND (p.title LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)`;
      params.push(like, like, like);
    }

    const MIN_PRICE = `(SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'active')`;
    let orderSql = " ORDER BY p.created_at DESC";
    if (sort === "price_asc") orderSql = ` ORDER BY ${MIN_PRICE} IS NULL, ${MIN_PRICE} ASC`;
    else if (sort === "price_desc") orderSql = ` ORDER BY ${MIN_PRICE} IS NULL, ${MIN_PRICE} DESC`;
    else if (sort === "title") orderSql = " ORDER BY p.title ASC";

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS c FROM products p${where}`)
      .bind(...params)
      .first<{ c: number }>();

    const products = await db
      .prepare(
        `SELECT p.id, p.slug, p.sku, p.title, p.short_description, p.product_type, p.material, p.plating, p.color,
                ${MIN_PRICE} AS price_from
         FROM products p${where}${orderSql} LIMIT ? OFFSET ?`,
      )
      .bind(...params, limit, offset)
      .all();

    // Gallery cover per page product (bounded to current page — no N+1 over the catalog)
    const ids = (products.results || []).map((p) => p.id as string);
    const covers: Record<string, string> = {};
    if (ids.length) {
      const ph = ids.map(() => "?").join(",");
      const mediaRows = await db
        .prepare(
          `SELECT product_id, url FROM product_media WHERE product_id IN (${ph}) AND type IN ('hero','gallery') ORDER BY sort_order ASC`,
        )
        .bind(...ids)
        .all<{ product_id: string; url: string }>();
      for (const m of mediaRows.results || []) {
        if (!covers[m.product_id]) covers[m.product_id] = m.url;
      }
    }

    return json({
      ok: true,
      products: (products.results || []).map((p) => ({ ...p, cover: covers[p.id as string] ?? null })),
      total: totalRow?.c ?? 0,
      meta: { limit, offset },
    });
  } catch (err) {
    return json({ ok: false, error: "catalog_error", detail: String(err) }, 500);
  }
};
