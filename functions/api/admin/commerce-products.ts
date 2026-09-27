// ---------------------------------------------------------------------------
//  Aromiso Commerce Products — Admin API
//  GET    /api/admin/commerce-products          → list products
//  GET    /api/admin/commerce-products?id=x     → single product detail
//  POST   /api/admin/commerce-products          → create/update product
//  DELETE /api/admin/commerce-products?id=x     → delete product
// ---------------------------------------------------------------------------

import type { Env } from "../../types";
import { isAuthed, json } from "./shared";
import { isBlankText } from "../../lib/product-short-description";

// ---- Audit D01: 短描述发布闸门（与 /api/admin/v2/commerce/products 同规则）----
// V1 仍是可路由的写入端点，不加闸门就等于给绕过留了后门。
const SHORT_DESC_REQUIRED_CODE = "SHORT_DESCRIPTION_REQUIRED";
const SHORT_DESC_REQUIRED_MSG =
  "short_description is required before a product can be published (status=active). " +
  "Write a factual one-line description, or save as draft and finish the copy later. " +
  "Leaving it blank is not allowed — an empty required field must never render as normal content.";

function uid(): string {
  return crypto.randomUUID();
}

function generateShortId(): string {
  // 8-char lowercase hex from random bytes
  const bytes = new Uint8Array(4);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---- V5.44: stable 6-digit image reference numbers -----------------------
// Owner workflow: spot a missed Chinese image on the storefront → open the
// product in admin → read the image's 6-digit number → process it manually.
// Numbers are keyed by URL (same asset = same number everywhere) and live in
// commerce_image_nos; the gallery JSON shape (array of URL strings) is
// untouched so the storefront needs no changes.
function randomImageNo(): number {
  return 100000 + Math.floor(Math.random() * 900000);
}

export async function ensureImageNos(
  db: NonNullable<Env["DB"]>,
  urls: unknown[],
): Promise<Record<string, number>> {
  const clean = [...new Set(urls.filter((u): u is string => typeof u === "string" && u !== ""))];
  if (clean.length === 0) return {};
  const out: Record<string, number> = {};
  for (let i = 0; i < clean.length; i += 50) {
    const chunk = clean.slice(i, i + 50);
    const rows = await db
      .prepare(
        `SELECT url, image_no FROM commerce_image_nos WHERE url IN (${chunk
          .map(() => "?")
          .join(",")})`,
      )
      .bind(...chunk)
      .all<Record<string, unknown>>();
    for (const r of rows.results) out[r.url as string] = Number(r.image_no);
  }
  for (const u of clean) {
    if (u in out) continue;
    for (let attempt = 0; attempt < 5; attempt++) {
      const res = await db
        .prepare("INSERT OR IGNORE INTO commerce_image_nos (url, image_no) VALUES (?, ?)")
        .bind(u, randomImageNo())
        .run();
      if (res.meta.changes > 0) {
        const r = await db
          .prepare("SELECT image_no FROM commerce_image_nos WHERE url = ?")
          .bind(u)
          .first<Record<string, unknown>>();
        out[u] = Number(r?.image_no);
        break;
      }
    }
  }
  return out;
}

// ---- GET: list / detail ---------------------------------------------------

async function handleGet(request: Request, env: Env): Promise<Response> {
  const db = env.DB!;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (id) {
    // Single product detail with variants, prices, images
    const product = await db
      .prepare("SELECT * FROM commerce_products WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();

    if (!product) return json({ error: "Product not found" }, 404);

    const galleryArr = JSON.parse((product.gallery as string) || "[]");
    // V5.44: stable 6-digit reference numbers, assigned on first open/save
    const imageNos = await ensureImageNos(db, [product.cover_image, ...galleryArr]);

    const variants = await db
      .prepare("SELECT * FROM commerce_product_variants WHERE product_id = ? ORDER BY created_at")
      .bind(id)
      .all<Record<string, unknown>>();

    const prices = await db
      .prepare("SELECT * FROM commerce_price_tiers WHERE product_id = ? ORDER BY min_qty")
      .bind(id)
      .all<Record<string, unknown>>();

    const images = await db
      .prepare(
        "SELECT * FROM commerce_product_images WHERE product_id = ? ORDER BY sort_order, created_at",
      )
      .bind(id)
      .all<Record<string, unknown>>();

    return json({
      ok: true,
      product: {
        ...product,
        gallery: galleryArr,
        image_nos: imageNos,
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
        attributes: JSON.parse((product.attributes as string) || "{}"),
        variants: variants.results.map((v) => ({
          ...v,
          options: JSON.parse((v.options_json as string) || "{}"),
        })),
        prices: prices.results,
        images: images.results,
      },
    });
  }

  // List products
  const status = url.searchParams.get("status") || "";
  const category = url.searchParams.get("category") || "";
  const search = url.searchParams.get("search") || "";
  const pid = url.searchParams.get("pid") || "";
  const qf = url.searchParams.get("qf") || "";
  const limit = Math.min(Number(url.searchParams.get("limit")) || 20, 200);
  const offset = Number(url.searchParams.get("offset")) || 0;

  // V5.17: quick-filter (data quality) conditions, shared by list + count
  const QF_WHERE: Record<string, string> = {
    no_desc: " AND (description IS NULL OR description = '')",
    no_highlights:
      " AND (product_highlights IS NULL OR product_highlights = '' OR product_highlights = '[]')",
    no_specs: " AND (specifications IS NULL OR specifications = '' OR specifications = '{}')",
    cn_title: " AND title GLOB '*[一-鿿]*'",
    no_cover: " AND (cover_image IS NULL OR cover_image = '')",
  };
  const qfWhere = QF_WHERE[qf] || "";
  const pidWhere = pid
    ? " AND (product_key LIKE ? OR source_product_key LIKE ? OR id LIKE ? OR display_product_code LIKE ? OR slug LIKE ?)"
    : "";
  const pidLikes = pid ? `%${pid}%` : "";

  let query =
    "SELECT id, product_key, slug, category, title, short_description, cover_image, status, moq, stock_status, lead_time, unit, source_type, source_platform, source_url, source_shop_name, cost_price, completeness, tags, created_at, updated_at, source_product_key, " +
    "(SELECT MIN(unit_price) FROM commerce_price_tiers WHERE product_id = commerce_products.id) AS min_price, " +
    "(SELECT MAX(unit_price) FROM commerce_price_tiers WHERE product_id = commerce_products.id) AS max_price, " +
    "(SELECT COUNT(*) FROM commerce_product_variants WHERE product_id = commerce_products.id) AS variant_count " +
    "FROM commerce_products WHERE 1=1";
  const params: string[] = [];

  if (status) {
    query += " AND status = ?";
    params.push(status);
  } else {
    // "全部"默认不含已下架商品（已下架只在专属 tab 显示）
    query += " AND status != 'archived'";
  }
  if (category) {
    query += " AND category = ?";
    params.push(category);
  }
  // V5.30: search also matches internal id / short_id / display_product_code,
  // so the merchandising "add product" box can search by 商品 ID / 1688 ID / 货号.
  const SEARCH_WHERE =
    " AND (title LIKE ? OR slug LIKE ? OR product_key LIKE ? OR source_product_key LIKE ? OR id LIKE ? OR short_id LIKE ? OR display_product_code LIKE ?)";
  if (search) {
    query += SEARCH_WHERE;
    const like = `%${search}%`;
    params.push(like, like, like, like, like, like, like);
  }
  if (pidWhere) {
    query += pidWhere;
    params.push(pidLikes, pidLikes, pidLikes, pidLikes, pidLikes);
  }
  query += qfWhere;

  query += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
  params.push(String(limit), String(offset));

  const products = await db
    .prepare(query)
    .bind(...params)
    .all<Record<string, unknown>>();

  // Get total count for badge
  let countQuery = "SELECT COUNT(*) as total FROM commerce_products WHERE 1=1";
  const countParams: string[] = [];
  if (status) {
    countQuery += " AND status = ?";
    countParams.push(status);
  } else {
    countQuery += " AND status != 'archived'";
  }
  if (category) {
    countQuery += " AND category = ?";
    countParams.push(category);
  }
  if (search) {
    countQuery += SEARCH_WHERE;
    const like = `%${search}%`;
    countParams.push(like, like, like, like, like, like, like);
  }
  if (pidWhere) {
    countQuery += pidWhere;
    countParams.push(pidLikes, pidLikes, pidLikes, pidLikes, pidLikes);
  }
  countQuery += qfWhere;
  const countResult = await db
    .prepare(countQuery)
    .bind(...countParams)
    .first<{ total: number }>();

  // Per-status counts (ignoring filters) for quick-filter tabs
  const statusRows = await db
    .prepare("SELECT status, COUNT(*) AS c FROM commerce_products GROUP BY status")
    .all<{ status: string; c: number }>();
  const statusCounts: Record<string, number> = {};
  let totalAll = 0;
  for (const row of statusRows.results) {
    statusCounts[row.status] = row.c;
    // "全部"tab 计数不含已下架
    if (row.status !== "archived") totalAll += row.c;
  }

  // V5.17: data-quality counts for quick-filter chips (non-archived pool)
  const quality = await db
    .prepare(
      `SELECT
         SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) AS no_desc,
         SUM(CASE WHEN product_highlights IS NULL OR product_highlights = '' OR product_highlights = '[]' THEN 1 ELSE 0 END) AS no_highlights,
         SUM(CASE WHEN specifications IS NULL OR specifications = '' OR specifications = '{}' THEN 1 ELSE 0 END) AS no_specs,
         SUM(CASE WHEN title GLOB '*[一-鿿]*' THEN 1 ELSE 0 END) AS cn_title,
         SUM(CASE WHEN cover_image IS NULL OR cover_image = '' THEN 1 ELSE 0 END) AS no_cover
       FROM commerce_products WHERE status != 'archived'`,
    )
    .first<Record<string, number>>();

  return json({
    ok: true,
    products: products.results,
    total: countResult?.total || 0,
    status_counts: statusCounts,
    total_all: totalAll,
    quality_counts: quality || {},
  });
}

// ---- Completeness calculation ----------------------------------------------

function calcCompleteness(p: Record<string, unknown>): number {
  let score = 0;
  if (p.title) score += 15;
  if (p.cover_image) score += 10;
  if (p.short_description) score += 10;
  if (p.description) score += 10;
  if (p.category) score += 10;
  if (p.moq) score += 5;
  if (p.specifications && JSON.stringify(p.specifications) !== "{}") score += 5;
  // Check if prices exist (passed in body.prices)
  if (p._has_prices) score += 15;
  if (p._has_variants) score += 10;
  if (p.seo_title) score += 5;
  if (p.seo_description) score += 5;
  return Math.min(score, 100);
}

// ---- V5.0 Data Health 8 维（保留 calcCompleteness 总分兼容）----
type HealthLevel = "ok" | "warn" | "missing";
interface DataHealth {
  basic: HealthLevel;
  images: HealthLevel;
  sku: HealthLevel;
  pricing: HealthLevel;
  attributes: HealthLevel;
  logistics: HealthLevel;
  seo: HealthLevel;
  source: HealthLevel;
  score: number;
}

function level(has: boolean, weak = false): HealthLevel {
  if (!has) return "missing";
  return weak ? "warn" : "ok";
}

function calcDataHealth(p: Record<string, unknown>): DataHealth {
  const has = (k: string) => !!p[k];
  const isObjNonEmpty = (k: string) => {
    const v = p[k];
    if (!v) return false;
    try {
      const s = typeof v === "string" ? v : JSON.stringify(v);
      return s !== "{}" && s !== "[]" && s.trim() !== "";
    } catch {
      return false;
    }
  };

  const basic = level(
    has("title") &&
      has("cover_image") &&
      has("short_description") &&
      has("description") &&
      has("category"),
  );
  const images = level(has("cover_image") && isObjNonEmpty("gallery"));
  const sku = level(!!p._has_variants);
  const pricing = has("cost_price")
    ? level(!!p._has_prices, !p._has_prices)
    : level(!!p._has_prices);
  const attributes = level(
    isObjNonEmpty("specifications") &&
      (isObjNonEmpty("materials") || isObjNonEmpty("fragrance_options")),
  );
  const logistics = level(
    has("weight") &&
      (has("units_per_carton") || has("carton_length_cm") || has("carton_weight_kg")),
  );
  const seo = level(has("seo_title") && has("seo_description"));
  const source = level(has("source_product_key") && has("supplier_product_code"));

  return {
    basic,
    images,
    sku,
    pricing,
    attributes,
    logistics,
    seo,
    source,
    score: calcCompleteness(p),
  };
}

// ---- POST: create / update ------------------------------------------------

async function handlePost(request: Request, env: Env): Promise<Response> {
  const db = env.DB!;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid JSON" }, 400);
  }

  const id = body.id as string | undefined;

  // V5.44: persist 6-digit reference numbers for any image in the payload
  await ensureImageNos(db, [
    body.cover_image,
    ...(Array.isArray(body.gallery) ? body.gallery : []),
  ]);

  if (id) {
    // Update existing product
    const existing = await db
      .prepare("SELECT id, status, short_description FROM commerce_products WHERE id = ?")
      .bind(id)
      .first<{ id: string; status: string | null; short_description: string | null }>();

    if (!existing) return json({ error: "Product not found" }, 404);

    const fields: string[] = [];
    const values: unknown[] = [];

    const updatable = [
      "title",
      "slug",
      "category",
      "short_description",
      "description",
      "cover_image",
      "gallery",
      "video_url",
      "status",
      "moq",
      "stock_status",
      "unit",
      "weight",
      "certifications",
      "oem_available",
      "cost_price",
      "key_features",
      "specifications",
      "materials",
      "fragrance_options",
      "packaging_options",
      "application",
      "tags",
      "shipping_info",
      "sample_available",
      "private_label",
      // Shop 2.0（V5.25）：现货可发标记（筛选层②⑤ / 卡片角标共用）
      "ready_to_ship",
      "product_highlights",
      "faq",
      "seo_title",
      "seo_description",
      // Supply chain fields (0020)
      "supplier_name",
      "supplier_shop_url",
      "supplier_product_code",
      "attributes",
      "category_l1",
      "category_l3",
      "units_per_carton",
      "import_batch",
      "source_last_verified",
      "health_status",
      // V5.0 后台可编辑的供应链身份（仅后台可见，前台脱敏）
      "source_product_key",
      "source_sku_id",
      "supplier_sku_code",
      "source_url",
      "source_platform",
      // ---- V5.0 新增（定价引擎 + 箱规 + 物流溯源 + 可读货号）----
      "display_product_code",
      "fx_rate_cny_usd",
      "markup_rule",
      "manual_price_override",
      "carton_length_cm",
      "carton_width_cm",
      "carton_height_cm",
      "carton_weight_kg",
      "carton_volume_cbm",
      "packaging_type",
      "logistics_meta",
    ];

    for (const field of updatable) {
      if (field in body) {
        fields.push(`${field} = ?`);
        const val = body[field];
        values.push(
          Array.isArray(val) || (typeof val === "object" && val !== null)
            ? JSON.stringify(val)
            : val,
        );
      }
    }

    if (fields.length === 0) return json({ error: "No fields to update" }, 400);

    // ---- Audit D01 闸门：不允许"新发布"或"清空"必填短描述 ----
    const nextStatus = "status" in body ? String(body.status ?? "") : String(existing.status ?? "");
    const storedShort = String(existing.short_description ?? "");
    const nextShort =
      "short_description" in body ? String(body.short_description ?? "") : storedShort;
    const wasActive = String(existing.status ?? "") === "active";
    // 历史遗留 active + 空短描述：改无关字段仍放行，只在响应里标 incomplete。
    const newlyPublishing = nextStatus === "active" && !wasActive;
    const blankingPublishedCopy =
      wasActive && nextStatus === "active" && isBlankText(nextShort) && !isBlankText(storedShort);
    if (
      nextStatus === "active" &&
      isBlankText(nextShort) &&
      (newlyPublishing || blankingPublishedCopy)
    ) {
      return json({ error: SHORT_DESC_REQUIRED_MSG, code: SHORT_DESC_REQUIRED_CODE }, 422);
    }
    const updateIncomplete = isBlankText(nextShort);

    fields.push("updated_at = ?");
    values.push(Math.floor(Date.now() / 1000));
    values.push(id);

    await db
      .prepare(`UPDATE commerce_products SET ${fields.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();

    // Handle variants update if provided
    if (Array.isArray(body.variants)) {
      await db.prepare("DELETE FROM commerce_product_variants WHERE product_id = ?").bind(id).run();
      for (const v of body.variants as Record<string, unknown>[]) {
        const vid = (v.id as string) || uid();
        await db
          .prepare(
            `INSERT INTO commerce_product_variants (
              id, product_id, sku, name, options_json, image, stock, status,
              source_sku_id, supplier_sku_code, display_sku_code,
              length_cm, width_cm, height_cm, weight_kg
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          )
          .bind(
            vid,
            id,
            (v.sku as string) || "",
            (v.name as string) || "",
            JSON.stringify(v.options || {}),
            (v.image as string) || "",
            (v.stock as number) ?? null,
            (v.status as string) || "active",
            (v.source_sku_id as string) || null,
            (v.supplier_sku_code as string) || null,
            (v.display_sku_code as string) || null,
            (v.length_cm as number) ?? null,
            (v.width_cm as number) ?? null,
            (v.height_cm as number) ?? null,
            (v.weight_kg as number) ?? null,
          )
          .run();
      }
    }

    // Handle prices update if provided
    if (Array.isArray(body.prices)) {
      await db.prepare("DELETE FROM commerce_price_tiers WHERE product_id = ?").bind(id).run();
      for (const p of body.prices as Record<string, unknown>[]) {
        const pid = (p.id as string) || uid();
        await db
          .prepare(
            "INSERT INTO commerce_price_tiers (id, product_id, variant_id, min_qty, max_qty, unit_price, currency) VALUES (?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            pid,
            id,
            (p.variant_id as string) || "",
            (p.min_qty as number) || 1,
            (p.max_qty as number) ?? null,
            (p.unit_price as number) || 0,
            (p.currency as string) || "USD",
          )
          .run();
      }
    }

    // Calculate and update completeness
    const updated = await db
      .prepare("SELECT * FROM commerce_products WHERE id = ?")
      .bind(id)
      .first<Record<string, unknown>>();
    if (updated) {
      const completenessData: Record<string, unknown> = { ...updated };
      completenessData._has_prices = Array.isArray(body.prices)
        ? body.prices.length > 0
        : (await db
            .prepare("SELECT COUNT(*) as c FROM commerce_price_tiers WHERE product_id = ?")
            .bind(id)
            .first<{ c: number }>())!.c > 0;
      completenessData._has_variants = Array.isArray(body.variants)
        ? body.variants.length > 0
        : (await db
            .prepare("SELECT COUNT(*) as c FROM commerce_product_variants WHERE product_id = ?")
            .bind(id)
            .first<{ c: number }>())!.c > 0;
      const completeness = calcCompleteness(completenessData);
      const dataHealth = calcDataHealth(completenessData);
      await db
        .prepare("UPDATE commerce_products SET completeness = ?, data_health_json = ? WHERE id = ?")
        .bind(completeness, JSON.stringify(dataHealth), id)
        .run();
    }

    // Audit D01: 保存成功 ≠ 内容完整。短描述为空时显式回报 incomplete。
    return json({
      ok: true,
      id,
      content_status: updateIncomplete ? "incomplete" : "complete",
      missing_required_fields: updateIncomplete ? ["short_description"] : [],
    });
  }

  // Create new product
  const productId = uid();
  const productKey = (body.product_key as string) || `prod-${Date.now()}`;
  const slug = (body.slug as string) || productKey;
  const shortId = generateShortId();
  const now = Math.floor(Date.now() / 1000);

  // ---- Audit D01 闸门：新建即发布（status != draft）必须带短描述 ----
  const createStatus = (body.status as string) || "draft";
  const createShort =
    typeof body.short_description === "string" ? body.short_description.trim() : "";
  if (createStatus !== "draft" && createShort === "") {
    return json({ error: SHORT_DESC_REQUIRED_MSG, code: SHORT_DESC_REQUIRED_CODE }, 422);
  }

  await db;
  await db
    .prepare(
      `INSERT INTO commerce_products (
           id, product_key, slug, short_id, category, title, short_description, description, cover_image, gallery, video_url,
           status, moq, stock_status, lead_time, unit, certifications, oem_available, source_type, tags, ready_to_ship,
           display_product_code, fx_rate_cny_usd, markup_rule, manual_price_override,
           carton_length_cm, carton_width_cm, carton_height_cm, carton_weight_kg, carton_volume_cbm,
           packaging_type, logistics_meta, created_at, updated_at
         )
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      productId,
      productKey,
      slug,
      shortId,
      (body.category as string) || "",
      (body.title as string) || "",
      createShort,
      (body.description as string) || "",
      (body.cover_image as string) || "",
      JSON.stringify(body.gallery || []),
      (body.video_url as string) || "",
      createStatus,
      (body.moq as number) || 1,
      (body.stock_status as string) || "in_stock",
      (body.lead_time as string) || "",
      (body.unit as string) || "pcs",
      JSON.stringify(body.certifications || []),
      (body.oem_available as number) ?? 1,
      (body.source_type as string) || "manual",
      JSON.stringify(body.tags || []),
      (body.ready_to_ship as number) ?? 0,
      (body.display_product_code as string) || "",
      (body.fx_rate_cny_usd as number) ?? null,
      (body.markup_rule as number) ?? null,
      (body.manual_price_override as number) ?? null,
      (body.carton_length_cm as number) ?? null,
      (body.carton_width_cm as number) ?? null,
      (body.carton_height_cm as number) ?? null,
      (body.carton_weight_kg as number) ?? null,
      (body.carton_volume_cbm as number) ?? null,
      (body.packaging_type as string) || "",
      typeof body.logistics_meta === "object" && body.logistics_meta !== null
        ? JSON.stringify(body.logistics_meta)
        : (body.logistics_meta as string) || "{}",
      now,
      now,
    )
    .run();

  // Insert variants if provided
  if (Array.isArray(body.variants)) {
    for (const v of body.variants as Record<string, unknown>[]) {
      const vid = uid();
      await db
        .prepare(
          "INSERT INTO commerce_product_variants (id, product_id, sku, name, options_json, image, stock, status, display_sku_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          vid,
          productId,
          (v.sku as string) || "",
          (v.name as string) || "",
          JSON.stringify(v.options || {}),
          (v.image as string) || "",
          (v.stock as number) ?? null,
          (v.status as string) || "active",
          (v.display_sku_code as string) || null,
        )
        .run();
    }
  }

  // Insert prices if provided
  if (Array.isArray(body.prices)) {
    for (const p of body.prices as Record<string, unknown>[]) {
      const pid = uid();
      await db
        .prepare(
          "INSERT INTO commerce_price_tiers (id, product_id, variant_id, min_qty, max_qty, unit_price, currency) VALUES (?, ?, ?, ?, ?, ?, ?)",
        )
        .bind(
          pid,
          productId,
          (p.variant_id as string) || "",
          (p.min_qty as number) || 1,
          (p.max_qty as number) ?? null,
          (p.unit_price as number) || 0,
          (p.currency as string) || "USD",
        )
        .run();
    }
  }

  // Calculate and update completeness for new product
  const newProduct = await db
    .prepare("SELECT * FROM commerce_products WHERE id = ?")
    .bind(productId)
    .first<Record<string, unknown>>();
  if (newProduct) {
    const completenessData: Record<string, unknown> = { ...newProduct };
    completenessData._has_prices = Array.isArray(body.prices) && body.prices.length > 0;
    completenessData._has_variants = Array.isArray(body.variants) && body.variants.length > 0;
    const completeness = calcCompleteness(completenessData);
    const dataHealth = calcDataHealth(completenessData);
    await db
      .prepare("UPDATE commerce_products SET completeness = ?, data_health_json = ? WHERE id = ?")
      .bind(completeness, JSON.stringify(dataHealth), productId)
      .run();
  }

  // Audit D01: draft 允许暂无短描述，但必须显式标记 incomplete。
  return json(
    {
      ok: true,
      id: productId,
      content_status: createShort === "" ? "incomplete" : "complete",
      missing_required_fields: createShort === "" ? ["short_description"] : [],
    },
    201,
  );
}

// ---- DELETE ---------------------------------------------------------------

async function handleDelete(request: Request, env: Env): Promise<Response> {
  const db = env.DB!;
  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  if (!id) return json({ error: "Missing product id" }, 400);

  const existing = await db
    .prepare("SELECT id FROM commerce_products WHERE id = ?")
    .bind(id)
    .first();

  if (!existing) return json({ error: "Product not found" }, 404);

  // D-01: D1 不可靠地强制 FK ON DELETE CASCADE，且 shop_product_categories /
  // shop_product_attributes 的 product_id 根本没有外键引用 → 单纯删主表会遗留孤儿行。
  // 改为原子 batch 显式清理全部子表（按 product_id）+ 主表，保证删除后引用一致。
  await db.batch([
    db.prepare("DELETE FROM commerce_product_variants WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM commerce_price_tiers WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM commerce_product_images WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM shop_product_categories WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM shop_product_attributes WHERE product_id = ?").bind(id),
    db.prepare("DELETE FROM commerce_products WHERE id = ?").bind(id),
  ]);

  return json({ ok: true });
}

// ---- Router ---------------------------------------------------------------

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  return handleGet(request, env);
};

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  return handlePost(request, env);
};

export const onRequestDelete: PagesFunction<Env> = async ({ request, env }) => {
  if (!(await isAuthed(request, env))) return json({ error: "Unauthorized" }, 401);
  return handleDelete(request, env);
};
