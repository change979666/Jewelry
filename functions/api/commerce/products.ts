// ---------------------------------------------------------------------------
//  Aromiso Commerce — Public Products API
//  GET /api/commerce/products              → list active products
//  GET /api/commerce/products?slug=x       → single product detail
//  GET /api/commerce/products?category=x   → filter by category
//  GET /api/commerce/products?tag=x        → filter by marketing tag (e.g. best_seller)
//  GET /api/commerce/products?featured=1   → only Featured placements (Shop 2.0)
//  GET /api/commerce/products?q=term       → search title/short_name/desc/category/tags/
//                                             materials/supplier_product_code/variant SKU
//  GET /api/commerce/products?compare=a,b  → compare multiple products (max 4)
//  GET /api/commerce/products?related=x    → related products in same category
//  GET /api/commerce/products?meta=categories → live category facets [{category,n}]
//
//  Shop 2.0 五层固定筛选（服务端过滤，V5.25/V5.26）:
//    rts=1 sample=1 plabel=1 oem=1 bulk=1 instock=1      → 采购/可用性布尔
//    moq_min=N moq_max=M                                  → MOQ 区间（如 100+ 用 moq_min=101）
//    price_min=X price_max=Y                              → 最低阶梯价区间
//    sort=featured|newest|price_asc|price_desc|moq_asc    → 排序（默认 newest）
// ---------------------------------------------------------------------------

import { isQuotaError } from "../../lib/d1-guard";
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

// Keep list enrichment bounded to the page the buyer is viewing. The previous
// catalog-wide aggregation re-read every active product's price tiers on every
// Shop request, which made normal browsing scale with the entire catalog.
const PRICE_TIER_BATCH_SIZE = 80;

async function loadPagePriceMap(
  db: D1Database,
  productIds: string[],
): Promise<Record<string, { min: number; tiers: number }>> {
  const priceMap: Record<string, { min: number; tiers: number }> = {};

  for (let i = 0; i < productIds.length; i += PRICE_TIER_BATCH_SIZE) {
    const batch = productIds.slice(i, i + PRICE_TIER_BATCH_SIZE);
    if (batch.length === 0) continue;

    const placeholders = batch.map(() => "?").join(",");
    const rows = await db
      .prepare(
        `SELECT product_id, MIN(unit_price) as min_price, COUNT(*) as tier_count
         FROM commerce_price_tiers
         WHERE product_id IN (${placeholders})
         GROUP BY product_id`,
      )
      .bind(...batch)
      .all<{ product_id: string; min_price: number; tier_count: number }>();

    for (const row of rows.results) {
      priceMap[row.product_id] = { min: row.min_price, tiers: row.tier_count };
    }
  }

  return priceMap;
}

// Internal-only columns that SELECT * would leak to the public storefront.
// V5.0 红线（2026-08-04）：1688 Offer ID / 1688 SKU ID / 供应商货号 / 1688 链接
// 均属内部供应链身份，前台绝不展示；对外改用 display_product_code / display_sku_code。
// supplier_name 保留公开（中性信息，非敏感 ID）。
const INTERNAL_PRODUCT_FIELDS = [
  "cost_price",
  "health_status",
  "supplier_shop_url",
  "import_batch",
  "source_last_verified",
  "attributes",
  "category_l1",
  "category_l3",
  // ---- V5.0 新增内部化（供应链身份隔离）----
  "source_product_key", // 1688 Offer ID
  "source_sku_id", // 1688 SKU ID
  "supplier_product_code", // 供应商货号 —— 仅参与搜索（§4.1 可搜不展示），不出现在列表 SELECT
  "supplier_sku_code",
  "source_url", // 含 1688 商品链接
  "source_platform", // 值如 "1688"
];

function sanitizeProduct(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!INTERNAL_PRODUCT_FIELDS.includes(key)) clean[key] = row[key];
  }
  return clean;
}

// Variant-level internal fields that must never reach the public storefront.
// V5.0 红线（2026-08-04）：1688 SKU ID / 供应商 SKU 货号 属内部供应链身份。
const INTERNAL_VARIANT_FIELDS = ["source_sku_id", "supplier_sku_code"];

function sanitizeVariant(row: Record<string, unknown>): Record<string, unknown> {
  const clean: Record<string, unknown> = {};
  for (const key of Object.keys(row)) {
    if (!INTERNAL_VARIANT_FIELDS.includes(key)) clean[key] = row[key];
  }
  return clean;
}

// Strip LIKE wildcards (%, _, \) from user input. This endpoint fans the q
// pattern across 8+ LIKE clauses, and Cloudflare D1's SQLite rejects an overly
// long/complex LIKE pattern ("LIKE or GLOB pattern too complex" → 500).
// Escaping (%) would double the length of all-wildcard input and still trip the
// limit; stripping keeps every pattern short and blocks wildcard-semantics
// injection. Normal keyword queries contain none of these chars → unchanged.
function likeSanitize(s: string): string {
  return s.replace(/[\\%_]/g, "");
}

// Lowest-tier price subquery (used by price filter & price sorting).
const MIN_PRICE_SUB =
  "(SELECT MIN(unit_price) FROM commerce_price_tiers t WHERE t.product_id = commerce_products.id)";

// Active Featured placement existence check (window + status aware).
const FEATURED_EXISTS =
  "EXISTS (SELECT 1 FROM product_merchandising m WHERE m.product_id = commerce_products.id AND m.placement_type = 'featured' AND m.status = 'active' AND (m.start_date IS NULL OR m.start_date <= date('now')) AND (m.end_date IS NULL OR m.end_date >= date('now')))";

const LIST_COLUMNS =
  "id, product_key, slug, short_id, category, title, short_name, short_description, cover_image, moq, sample_available, private_label, ready_to_ship, quote_required, stock_status, lead_time, unit, oem_available, completeness, tags, certifications, created_at";

const SORT_WHITELIST = ["featured", "newest", "price_asc", "price_desc", "moq_asc"];

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = env.DB;
  if (!db) return json({ error: "Database unavailable" }, 500);

  const url = new URL(request.url);
  const slug = url.searchParams.get("slug");
  const shortId = url.searchParams.get("id");
  const category = url.searchParams.get("category");
  const compare = url.searchParams.get("compare");
  const related = url.searchParams.get("related");
  // Marketing-tag filter (V5.24 商城热销位): only lowercase/digits/underscore
  // are valid tag keys — anything else is ignored (prevents LIKE wildcards).
  const tagRaw = url.searchParams.get("tag") || "";
  const tag = /^[a-z0-9_]+$/.test(tagRaw) ? tagRaw : "";
  // S-07: clamp both bounds on this public endpoint — a negative/NaN limit must
  // never become `LIMIT -1` (SQLite "no limit" → full products table to anon).
  const rawLimit = parseInt(url.searchParams.get("limit") || "", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(100, Math.max(1, rawLimit)) : 30;
  const rawOffset = parseInt(url.searchParams.get("offset") || "", 10);
  const offset = Number.isFinite(rawOffset) ? Math.max(0, rawOffset) : 0;

  // ---- Shop 2.0 筛选/排序/搜索参数 ----
  // S-04: cap q to 40 — the pattern is reused across 8+ LIKE clauses and D1
  // rejects long LIKE patterns ("pattern too complex" → 500; q≥~50 tripped it).
  const q = (url.searchParams.get("q") || "").trim().slice(0, 40);
  const rts = url.searchParams.get("rts") === "1";
  const ff = (url.searchParams.get("ff") || "").trim().slice(0, 60);
  const cap = (url.searchParams.get("cap") || "").trim().slice(0, 40);
  const sample = url.searchParams.get("sample") === "1";
  const plabel = url.searchParams.get("plabel") === "1";
  const oem = url.searchParams.get("oem") === "1";
  const bulk = url.searchParams.get("bulk") === "1";
  const instock = url.searchParams.get("instock") === "1";
  const featured = url.searchParams.get("featured") === "1";
  const meta = url.searchParams.get("meta") || "";
  const moqMin = parseInt(url.searchParams.get("moq_min") || "", 10) || 0;
  const moqMax = parseInt(url.searchParams.get("moq_max") || "", 10) || 0;
  const priceMin = parseFloat(url.searchParams.get("price_min") || "");
  const priceMax = parseFloat(url.searchParams.get("price_max") || "");
  const sortRaw = url.searchParams.get("sort") || "newest";
  const sort = SORT_WHITELIST.includes(sortRaw) ? sortRaw : "newest";

  try {
    // Facet metadata: distinct live categories (drives the Shop category filter,
    // so the UI never hardcodes category names that drift from real data).
    if (meta === "categories") {
      const rows = await db
        .prepare(
          "SELECT category, COUNT(*) as n FROM commerce_products WHERE status = 'active' AND category != '' GROUP BY category ORDER BY n DESC",
        )
        .all<{ category: string; n: number }>();
      return json({ ok: true, categories: rows.results || [] });
    }

    // V5.66：香型族 / 容量桶 facets（前台 shop 筛选；数据来自 backfill-shop-facets）
    if (meta === "facets") {
      const ffRows = await db
        .prepare(
          `SELECT f.slug, f.name_en, f.name_zh, COUNT(*) AS n
           FROM shop_product_fragrances pf
           JOIN shop_fragrances f ON f.id = pf.fragrance_id
           JOIN commerce_products p ON p.id = pf.product_id AND p.status = 'active'
           GROUP BY f.slug ORDER BY n DESC`,
        )
        .all<{ slug: string; name_en: string; name_zh: string; n: number }>();
      const capRows = await db
        .prepare(
          `SELECT av.value, av.value_number, COUNT(*) AS n
           FROM shop_product_attributes pa
           JOIN shop_attribute_values av ON av.id = pa.value_id
           JOIN shop_attributes a ON a.id = pa.attribute_id AND a.code = 'capacity'
           JOIN commerce_products p ON p.id = pa.product_id AND p.status = 'active'
           GROUP BY av.value ORDER BY av.value_number`,
        )
        .all<{ value: string; value_number: number; n: number }>();
      return json({
        ok: true,
        fragrance_families: ffRows.results || [],
        capacity_buckets: capRows.results || [],
      });
    }

    // Compare multiple products
    if (compare) {
      const slugs = compare
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean)
        .slice(0, 4);
      if (slugs.length === 0) return json({ error: "No slugs provided" }, 400);

      const placeholders = slugs.map(() => "?").join(",");
      const products = await db
        .prepare(
          `SELECT * FROM commerce_products WHERE slug IN (${placeholders}) AND status = 'active'`,
        )
        .bind(...slugs)
        .all<Record<string, unknown>>();

      const detailed = await Promise.all(
        products.results.map(async (product) => {
          const variants = await db
            .prepare(
              "SELECT * FROM commerce_product_variants WHERE product_id = ? AND status = 'active' ORDER BY created_at",
            )
            .bind(product.id as string)
            .all<Record<string, unknown>>();

          const prices = await db
            .prepare("SELECT * FROM commerce_price_tiers WHERE product_id = ? ORDER BY min_qty")
            .bind(product.id as string)
            .all<Record<string, unknown>>();

          return {
            ...sanitizeProduct(product),
            gallery: JSON.parse((product.gallery as string) || "[]"),
            certifications: JSON.parse((product.certifications as string) || "[]"),
            key_features: JSON.parse((product.key_features as string) || "[]"),
            specifications: JSON.parse((product.specifications as string) || "{}"),
            fragrance_options: JSON.parse((product.fragrance_options as string) || "[]"),
            packaging_options: JSON.parse((product.packaging_options as string) || "[]"),
            application: JSON.parse((product.application as string) || "[]"),
            tags: JSON.parse((product.tags as string) || "[]"),
            shipping_info: JSON.parse((product.shipping_info as string) || "{}"),
            product_highlights: JSON.parse((product.product_highlights as string) || "[]"),
            faq: JSON.parse((product.faq as string) || "[]"),
            variants: variants.results.map((v) => ({
              ...sanitizeVariant(v),
              options: JSON.parse((v.options_json as string) || "{}"),
            })),
            price_tiers: prices.results,
          };
        }),
      );

      return json({ ok: true, products: detailed });
    }

    // Related products (same category)
    if (related) {
      const current = await db
        .prepare("SELECT id, category FROM commerce_products WHERE slug = ? AND status = 'active'")
        .bind(related)
        .first<{ id: string; category: string }>();

      if (!current) return json({ error: "Product not found" }, 404);

      const relatedProducts = await db
        .prepare(
          `SELECT ${LIST_COLUMNS} FROM commerce_products WHERE status = 'active' AND category = ? AND id != ? ORDER BY created_at DESC LIMIT ?`,
        )
        .bind(current.category, current.id, limit)
        .all<Record<string, unknown>>();

      // Attach lowest price for each related product
      const relIds = relatedProducts.results.map((p) => p.id as string);
      const relPriceMap: Record<string, number> = {};

      if (relIds.length > 0) {
        const ph = relIds.map(() => "?").join(",");
        const minPrices = await db
          .prepare(
            `SELECT product_id, MIN(unit_price) as min_price FROM commerce_price_tiers WHERE product_id IN (${ph}) GROUP BY product_id`,
          )
          .bind(...relIds)
          .all<{ product_id: string; min_price: number }>();

        for (const row of minPrices.results) {
          relPriceMap[row.product_id] = row.min_price;
        }
      }

      const enriched = relatedProducts.results.map((p) => ({
        ...p,
        price_from: relPriceMap[p.id as string] ?? null,
      }));

      return json({ ok: true, products: enriched });
    }

    // Single product detail (by short_id or slug)
    if (shortId || slug) {
      let product: Record<string, unknown> | null = null;

      if (shortId) {
        // Lookup by short_id
        product = await db
          .prepare("SELECT * FROM commerce_products WHERE short_id = ? AND status = 'active'")
          .bind(shortId)
          .first<Record<string, unknown>>();
      }

      if (!product && slug) {
        // Lookup by slug (backward compat)
        product = await db
          .prepare("SELECT * FROM commerce_products WHERE slug = ? AND status = 'active'")
          .bind(slug)
          .first<Record<string, unknown>>();
      }

      if (!product) return json({ error: "Product not found" }, 404);

      const variants = await db
        .prepare(
          "SELECT * FROM commerce_product_variants WHERE product_id = ? AND status = 'active' ORDER BY created_at",
        )
        .bind(product.id as string)
        .all<Record<string, unknown>>();

      const prices = await db
        .prepare("SELECT * FROM commerce_price_tiers WHERE product_id = ? ORDER BY min_qty")
        .bind(product.id as string)
        .all<Record<string, unknown>>();

      return json({
        ok: true,
        product: {
          ...sanitizeProduct(product),
          gallery: JSON.parse((product.gallery as string) || "[]"),
          certifications: JSON.parse((product.certifications as string) || "[]"),
          key_features: JSON.parse((product.key_features as string) || "[]"),
          specifications: JSON.parse((product.specifications as string) || "{}"),
          fragrance_options: JSON.parse((product.fragrance_options as string) || "[]"),
          packaging_options: JSON.parse((product.packaging_options as string) || "[]"),
          application: JSON.parse((product.application as string) || "[]"),
          tags: JSON.parse((product.tags as string) || "[]"),
          shipping_info: JSON.parse((product.shipping_info as string) || "{}"),
          product_highlights: JSON.parse((product.product_highlights as string) || "[]"),
          faq: JSON.parse((product.faq as string) || "[]"),
          materials: product.materials ?? null,
          sample_available: product.sample_available ?? false,
          private_label: product.private_label ?? false,
          seo_title: product.seo_title ?? null,
          seo_description: product.seo_description ?? null,
          completeness: product.completeness ?? null,
          variants: variants.results.map((v) => ({
            ...sanitizeVariant(v),
            options: JSON.parse((v.options_json as string) || "{}"),
          })),
          price_tiers: prices.results,
        },
      });
    }

    // ------------------------------------------------------------------
    // Product list — server-side 5-layer filtering (Shop 2.0 P0)
    // ------------------------------------------------------------------
    let where = " WHERE status = 'active'";
    const params: (string | number)[] = [];

    if (category) {
      where += " AND category = ?";
      params.push(category);
    }
    if (tag) {
      // tags is a JSON array string, e.g. ["best_seller","hot_europe"].
      where += " AND tags LIKE ?";
      params.push('%"' + tag + '"%');
    }
    if (featured) {
      where += ` AND ${FEATURED_EXISTS}`;
    }
    if (q) {
      // §4.1 搜索范围：title/short_name/desc/category/tags/materials/
      // supplier_product_code（可搜不展示）/variant SKU。1688 ID 不参与。
      const like = "%" + likeSanitize(q) + "%";
      const esc = " ESCAPE '\\'";
      where +=
        " AND (title LIKE ?" +
        esc +
        " OR short_name LIKE ?" +
        esc +
        " OR short_description LIKE ?" +
        esc +
        " OR category LIKE ?" +
        esc +
        " OR tags LIKE ?" +
        esc +
        " OR materials LIKE ?" +
        esc +
        " OR supplier_product_code LIKE ?" +
        esc +
        " OR EXISTS (SELECT 1 FROM commerce_product_variants v WHERE v.product_id = commerce_products.id AND v.sku LIKE ?" +
        esc +
        "))";
      params.push(like, like, like, like, like, like, like, like);
    }
    if (rts) where += " AND ready_to_ship = 1";
    if (sample) where += " AND sample_available = 1";
    if (plabel) where += " AND private_label = 1";
    if (oem) where += " AND oem_available = 1";
    if (instock) where += " AND stock_status = 'in_stock'";
    if (ff) {
      where +=
        " AND EXISTS (SELECT 1 FROM shop_product_fragrances pf JOIN shop_fragrances f ON f.id = pf.fragrance_id WHERE pf.product_id = commerce_products.id AND f.slug = ?)";
      params.push(ff);
    }
    if (cap) {
      where +=
        " AND EXISTS (SELECT 1 FROM shop_product_attributes pa JOIN shop_attribute_values av ON av.id = pa.value_id JOIN shop_attributes a ON a.id = pa.attribute_id WHERE pa.product_id = commerce_products.id AND a.code = 'capacity' AND av.value = ?)";
      params.push(cap);
    }
    if (moqMax > 0) {
      where += " AND moq <= ?";
      params.push(moqMax);
    }
    if (moqMin > 0) {
      where += " AND moq >= ?";
      params.push(moqMin);
    }
    if (bulk) {
      // Bulk Pricing = 有 2 档及以上阶梯价（§3.1②；不新增冗余布尔列）
      where +=
        " AND (SELECT COUNT(*) FROM commerce_price_tiers t WHERE t.product_id = commerce_products.id) >= 2";
    }
    if (!isNaN(priceMin) || !isNaN(priceMax)) {
      where += ` AND ${MIN_PRICE_SUB} IS NOT NULL`;
      if (!isNaN(priceMin)) {
        where += ` AND ${MIN_PRICE_SUB} >= ?`;
        params.push(priceMin);
      }
      if (!isNaN(priceMax)) {
        where += ` AND ${MIN_PRICE_SUB} <= ?`;
        params.push(priceMax);
      }
    }

    // Get total count first (for pagination).
    // V5.54 配额防护：COUNT 每次全表扫描（行读配额敏感），用 KV 缓存 10 分钟。
    // 键由 where + 参数推导；KV 不可用时回退直查，行为不受影响。
    let total = 0;
    const countSql = "SELECT COUNT(*) as total FROM commerce_products" + where;
    const cacheKey =
      "api:products:count:" +
      (where.length + ":" + params.map((p) => String(p)).join("|")).slice(0, 200);
    let cached: string | null = null;
    try {
      cached = (await env.DRAFTS?.get(cacheKey)) ?? null;
    } catch {
      cached = null;
    }
    if (cached != null && cached !== "") {
      total = Number(cached) || 0;
    } else {
      const countResult = params.length
        ? await db
            .prepare(countSql)
            .bind(...params)
            .first<{ total: number }>()
        : await db.prepare(countSql).first<{ total: number }>();
      total = countResult?.total || 0;
      try {
        await env.DRAFTS?.put(cacheKey, String(total), { expirationTtl: 600 });
      } catch {
        /* 缓存失败不影响结果 */
      }
    }

    let orderSql: string;
    switch (sort) {
      case "price_asc":
        orderSql = ` ORDER BY ${MIN_PRICE_SUB} IS NULL, ${MIN_PRICE_SUB} ASC, created_at DESC`;
        break;
      case "price_desc":
        orderSql = ` ORDER BY ${MIN_PRICE_SUB} IS NULL, ${MIN_PRICE_SUB} DESC, created_at DESC`;
        break;
      case "moq_asc":
        orderSql = " ORDER BY moq IS NULL, moq ASC, created_at DESC";
        break;
      case "featured":
        orderSql =
          " ORDER BY (SELECT COALESCE(MAX(m.priority), 0) FROM product_merchandising m WHERE m.product_id = commerce_products.id AND m.placement_type = 'featured' AND m.status = 'active') DESC, created_at DESC";
        break;
      default:
        orderSql = " ORDER BY created_at DESC";
    }

    params.push(limit, offset);
    const products = await db
      .prepare(`SELECT ${LIST_COLUMNS} FROM commerce_products${where}${orderSql} LIMIT ? OFFSET ?`)
      .bind(...params)
      .all<Record<string, unknown>>();

    // Enrich only the current page. This keeps price reads proportional to the
    // visible result set instead of the full active catalog.
    const pageIds = products.results
      .map((product) => product.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0);
    const priceMap = await loadPagePriceMap(db, pageIds);

    const enriched = products.results.map((p) => ({
      ...p,
      price_from: priceMap[p.id as string]?.min ?? null,
      tiers_count: priceMap[p.id as string]?.tiers ?? 0,
    }));

    return json({ ok: true, products: enriched, total: total });
  } catch (err) {
    if (isQuotaError(err)) {
      return json(
        { error: "Product catalog temporarily unavailable", code: "CATALOG_QUOTA" },
        503,
        { "Retry-After": "120" },
      );
    }
    return json({ error: "Internal error", code: "CATALOG_ERROR" }, 500);
  }
};
