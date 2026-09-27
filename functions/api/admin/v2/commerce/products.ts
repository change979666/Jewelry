// Phase 5 — V2 Commerce Products API
// GET    /api/admin/v2/commerce/products      → list (search/filter/sort/paginate)
// GET    /api/admin/v2/commerce/products?id=x → single product detail
// POST   /api/admin/v2/commerce/products      → create/update product
// DELETE /api/admin/v2/commerce/products?id=x → soft-delete product

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { isBlankText } from "../../../../lib/product-short-description";

// ---- Audit D01: 短描述发布闸门 --------------------------------------------
// commerce_products.short_description 是公开商品页/卡片的必填展示文案。
// 历史上 2431 条 active 商品该字段全空，前端按 `|| ''` 渲染，把缺失伪装成正常。
// 闸门规则：**只有转/处于 active（发布）时才强制**。draft 允许留空，但响应里必须
// 带 content_status="incomplete"，让调用方无法把它当成完整数据。
const SHORT_DESC_REQUIRED_CODE = "SHORT_DESCRIPTION_REQUIRED";
const SHORT_DESC_REQUIRED_MSG =
  "short_description is required before a product can be published (status=active). " +
  "Write a factual one-line description, or save as draft and finish the copy later. " +
  "Leaving it blank is not allowed — an empty required field must never render as normal content.";

function ok(data: unknown, meta?: unknown): Response {
  return new Response(JSON.stringify({ success: true, data, error: null, meta: meta || null }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
function fail(code: string, message: string, status: number): Response {
  return new Response(
    JSON.stringify({ success: false, data: null, error: { code, message }, meta: null }),
    { status, headers: { "Content-Type": "application/json" } },
  );
}

function uid(): string {
  return crypto.randomUUID();
}

export const onRequest: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const user = await authenticateRequest(request, env);
  const err = requirePermission(user, "commerce", "view");
  if (err) return err;

  const db = env.DB!;
  const url = new URL(request.url);
  const method = request.method;

  // ---- GET: list or detail ----
  if (method === "GET") {
    const id = url.searchParams.get("id");

    if (id) {
      const product = await db
        .prepare("SELECT * FROM commerce_products WHERE id = ?")
        .bind(id)
        .first<Record<string, unknown>>();
      if (!product) return fail("NOT_FOUND", "Product not found", 404);

      const variants = await db
        .prepare("SELECT * FROM commerce_product_variants WHERE product_id = ? ORDER BY created_at")
        .bind(id)
        .all();
      const prices = await db
        .prepare("SELECT * FROM commerce_price_tiers WHERE product_id = ? ORDER BY min_qty")
        .bind(id)
        .all();
      const images = await db
        .prepare(
          "SELECT * FROM commerce_product_images WHERE product_id = ? ORDER BY sort_order, created_at",
        )
        .bind(id)
        .all();

      // Parse JSON fields
      const jsonFields = [
        "gallery",
        "certifications",
        "key_features",
        "specifications",
        "fragrance_options",
        "packaging_options",
        "application",
        "tags",
        "shipping_info",
        "product_highlights",
        "faq",
        "attributes",
      ];
      // S42：损坏字段不再静默 keep raw（同字段两种类型无标记）；置 null 并记入
      // parse_errors 随 meta 返回，调用方可见「哪些字段没读出来」。
      const parseErrors: string[] = [];
      for (const f of jsonFields) {
        const fallback =
          f === "specifications" || f === "shipping_info" || f === "attributes" ? "{}" : "[]";
        try {
          product[f] = JSON.parse((product[f] as string) || fallback);
        } catch {
          product[f] = null;
          parseErrors.push(f);
        }
      }
      // S41：变体 options_json 损坏不再让整页 500；回 {} 并标记到 parse_errors。
      product.variants = variants.results.map((v) => {
        let options: unknown = {};
        try {
          options = JSON.parse(((v as Record<string, unknown>).options_json as string) || "{}");
        } catch {
          parseErrors.push(`variant:${(v as Record<string, unknown>).id ?? "?"}.options_json`);
        }
        return { ...v, options };
      });
      product.prices = prices.results;
      product.images = images.results;

      return ok(product, parseErrors.length ? { parse_errors: parseErrors } : undefined);
    }

    // List with filters
    const _errEdit = requirePermission(user, "commerce", "edit");
    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const offset = (page - 1) * pageSize;
    const status = url.searchParams.get("status") || "";
    const category = url.searchParams.get("category") || "";
    const search = url.searchParams.get("search") || "";
    const sort = url.searchParams.get("sort") || "updated_at";
    const order = url.searchParams.get("order") === "asc" ? "ASC" : "DESC";
    const qf = url.searchParams.get("qf") || "";

    const allowedSorts: Record<string, string> = {
      updated_at: "updated_at",
      created_at: "created_at",
      title: "title",
      status: "status",
      category: "category",
      completeness: "completeness",
    };
    const sortCol = allowedSorts[sort] || "updated_at";

    const QF_WHERE: Record<string, string> = {
      no_desc: " AND (description IS NULL OR description = '')",
      no_highlights:
        " AND (product_highlights IS NULL OR product_highlights = '' OR product_highlights = '[]')",
      no_specs: " AND (specifications IS NULL OR specifications = '' OR specifications = '{}')",
      cn_title: " AND title GLOB '*[一-鿿]*'",
      no_cover: " AND (cover_image IS NULL OR cover_image = '')",
    };
    const qfWhere = QF_WHERE[qf] || "";

    let query =
      "SELECT id, product_key, slug, category, title, short_description, cover_image, status, moq, stock_status, lead_time, unit, source_type, cost_price, completeness, tags, created_at, updated_at, source_product_key, display_product_code, deleted_at, (SELECT MIN(unit_price) FROM commerce_price_tiers WHERE product_id = commerce_products.id) AS min_price, (SELECT MAX(unit_price) FROM commerce_price_tiers WHERE product_id = commerce_products.id) AS max_price, (SELECT COUNT(*) FROM commerce_product_variants WHERE product_id = commerce_products.id) AS variant_count FROM commerce_products WHERE deleted_at IS NULL";
    const params: (string | number)[] = [];

    if (status) {
      query += " AND status = ?";
      params.push(status);
    } else {
      query += " AND status != 'archived'";
    }
    if (category) {
      query += " AND category = ?";
      params.push(category);
    }
    if (search) {
      query +=
        " AND (title LIKE ? OR slug LIKE ? OR product_key LIKE ? OR source_product_key LIKE ? OR id LIKE ? OR display_product_code LIKE ?)";
      const like = `%${search}%`;
      params.push(like, like, like, like, like, like);
    }
    query += qfWhere;

    // Count — extract WHERE clause from main query (after "FROM commerce_products WHERE")
    const mainFromIdx = query.indexOf(" FROM commerce_products WHERE ");
    const countQuery =
      "SELECT COUNT(*) as total FROM commerce_products" +
      (mainFromIdx >= 0 ? query.slice(mainFromIdx + " FROM commerce_products".length) : "");
    const countRow = params.length
      ? await db
          .prepare(countQuery)
          .bind(...params)
          .first<{ total: number }>()
      : await db.prepare(countQuery).first<{ total: number }>();
    const total = countRow?.total || 0;

    query += ` ORDER BY ${sortCol} ${order} LIMIT ? OFFSET ?`;
    params.push(pageSize, offset);
    const products = params.length
      ? await db
          .prepare(query)
          .bind(...params)
          .all()
      : await db.prepare(query).all();

    // Status counts
    const statusRows = await db
      .prepare(
        "SELECT status, COUNT(*) AS c FROM commerce_products WHERE deleted_at IS NULL GROUP BY status",
      )
      .all<{ status: string; c: number }>();
    const statusCounts: Record<string, number> = {};
    let totalAll = 0;
    for (const row of statusRows.results) {
      statusCounts[row.status] = row.c;
      if (row.status !== "archived") totalAll += row.c;
    }

    // Data quality counts
    const quality = await db
      .prepare(
        `SELECT SUM(CASE WHEN description IS NULL OR description = '' THEN 1 ELSE 0 END) AS no_desc, SUM(CASE WHEN product_highlights IS NULL OR product_highlights = '' OR product_highlights = '[]' THEN 1 ELSE 0 END) AS no_highlights, SUM(CASE WHEN specifications IS NULL OR specifications = '' OR specifications = '{}' THEN 1 ELSE 0 END) AS no_specs, SUM(CASE WHEN title GLOB '*[一-鿿]*' THEN 1 ELSE 0 END) AS cn_title, SUM(CASE WHEN cover_image IS NULL OR cover_image = '' THEN 1 ELSE 0 END) AS no_cover FROM commerce_products WHERE deleted_at IS NULL AND status != 'archived'`,
      )
      .first<Record<string, number>>();

    return ok(products.results, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      statusCounts,
      totalAll,
      qualityCounts: quality || {},
    });
  }

  // ---- POST: create/update ----
  if (method === "POST") {
    const errEdit = requirePermission(user, "commerce", "edit");
    if (errEdit) return errEdit;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_ERROR", "Invalid JSON", 400);
    }

    const id = body.id as string | undefined;
    const now = Math.floor(Date.now() / 1000);

    if (id) {
      // Update
      const existing = await db
        .prepare(
          "SELECT id, status, short_description, cover_image, quote_required FROM commerce_products WHERE id = ? AND deleted_at IS NULL",
        )
        .bind(id)
        .first<{
          id: string;
          status: string | null;
          short_description: string | null;
          cover_image: string | null;
          quote_required: number | null;
        }>();
      if (!existing) return fail("NOT_FOUND", "Product not found", 404);

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
        "ready_to_ship",
        "quote_required",
        "product_highlights",
        "faq",
        "seo_title",
        "seo_description",
        "supplier_name",
        "supplier_shop_url",
        "supplier_product_code",
        "attributes",
        "category_l1",
        "category_l3",
        "units_per_carton",
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
      const fields: string[] = [];
      const values: unknown[] = [];
      for (const f of updatable) {
        if (f in body) {
          fields.push(`${f} = ?`);
          const val = body[f];
          values.push(
            Array.isArray(val) || (typeof val === "object" && val !== null)
              ? JSON.stringify(val)
              : val,
          );
        }
      }
      if (fields.length === 0) return fail("VALIDATION_ERROR", "No fields to update", 400);

      // ---- Audit D01 闸门：不允许"新发布"或"清空"必填短描述 ----
      // nextStatus / nextShort = 本次写入生效后的值（body 没带就沿用库里的）。
      const nextStatus =
        "status" in body ? String(body.status ?? "") : String(existing.status ?? "");
      const storedShort = String(existing.short_description ?? "");
      const nextShort =
        "short_description" in body ? String(body.short_description ?? "") : storedShort;
      const wasActive = String(existing.status ?? "") === "active";
      // 只在"状态发生变化的发布动作"或"主动清空已发布商品的文案"时拦截；
      // 历史遗留的 active + 空短描述行，改价格等无关字段仍然放行（否则等于
      // 一次性锁死 2431 条商品的后台编辑），改为在响应里标记 incomplete。
      const newlyPublishing = nextStatus === "active" && !wasActive;
      const blankingPublishedCopy =
        wasActive && nextStatus === "active" && isBlankText(nextShort) && !isBlankText(storedShort);
      if (
        nextStatus === "active" &&
        isBlankText(nextShort) &&
        (newlyPublishing || blankingPublishedCopy)
      ) {
        return fail(SHORT_DESC_REQUIRED_CODE, SHORT_DESC_REQUIRED_MSG, 422);
      }
      // V5.69 Product OS 数据质量硬闸：新发布(active)还必须有封面图 + 至少一个价格档，
      // 否则前台/下单链路残缺。只闸「新发布」转换，不锁历史 active 行的无关编辑。
      if (newlyPublishing) {
        const nextCover =
          "cover_image" in body
            ? String(body.cover_image ?? "")
            : String(existing.cover_image ?? "");
        if (isBlankText(nextCover)) {
          return fail(
            "COVER_IMAGE_REQUIRED",
            "Cannot publish: cover_image is required for an active product",
            422,
          );
        }
        const nextQuote =
          "quote_required" in body
            ? Number(body.quote_required) === 1
            : Number(existing.quote_required) === 1;
        const tierRow = await db
          .prepare(`SELECT COUNT(*) AS c FROM commerce_price_tiers WHERE product_id = ?`)
          .bind(id)
          .first<{ c: number | null }>();
        if (!(Number(tierRow?.c || 0) > 0) && !nextQuote) {
          return fail(
            "PRICE_TIER_REQUIRED",
            "Cannot publish: an active product needs at least one price tier, or quote_required=1 (Price on Request)",
            422,
          );
        }
      }
      const updateIncomplete = isBlankText(nextShort);

      fields.push("updated_at = ?");
      values.push(now);
      values.push(id);

      // S20：商品行 + 变体（先全删再插）+ 价格档（先全删再插）必须原子提交。
      // 旧实现逐条 .run()，任一插入中途抛错会留下「0 变体 / 0 价格档」的半损状态，
      // 下单时报 No pricing。改为单事务 db.batch()，全成功或全回滚。
      const batch: D1PreparedStatement[] = [
        db
          .prepare(`UPDATE commerce_products SET ${fields.join(", ")} WHERE id = ?`)
          .bind(...values),
      ];

      // Variants
      if (Array.isArray(body.variants)) {
        batch.push(
          db.prepare("DELETE FROM commerce_product_variants WHERE product_id = ?").bind(id),
        );
        for (const v of body.variants as Record<string, unknown>[]) {
          batch.push(
            db
              .prepare(
                "INSERT INTO commerce_product_variants (id, product_id, sku, name, options_json, image, stock, status, source_sku_id, supplier_sku_code, display_sku_code, length_cm, width_cm, height_cm, weight_kg) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
              )
              .bind(
                (v.id as string) || uid(),
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
              ),
          );
        }
      }
      // Prices
      if (Array.isArray(body.prices)) {
        batch.push(db.prepare("DELETE FROM commerce_price_tiers WHERE product_id = ?").bind(id));
        for (const p of body.prices as Record<string, unknown>[]) {
          batch.push(
            db
              .prepare(
                "INSERT INTO commerce_price_tiers (id, product_id, variant_id, min_qty, max_qty, unit_price, currency) VALUES (?,?,?,?,?,?,?)",
              )
              .bind(
                (p.id as string) || uid(),
                id,
                (p.variant_id as string) || null,
                (p.min_qty as number) || 1,
                (p.max_qty as number) ?? null,
                (p.unit_price as number) || 0,
                (p.currency as string) || "USD",
              ),
          );
        }
      }

      await db.batch(batch);

      // Audit D01: 保存成功 ≠ 内容完整。短描述为空时显式回报 incomplete，
      // 前端/后台据此渲染缺失态，而不是当成正常商品。
      return ok({
        id,
        content_status: updateIncomplete ? "incomplete" : "complete",
        missing_required_fields: updateIncomplete ? ["short_description"] : [],
      });
    }

    // Create
    const errCreate = requirePermission(user, "commerce", "create");
    if (errCreate) return errCreate;

    const productId = uid();
    const productKey = (body.product_key as string) || `prod-${Date.now()}`;
    const slug = (body.slug as string) || productKey;

    // ---- Audit D01 闸门：新建即发布（status != draft）必须带短描述 ----
    const createStatus = (body.status as string) || "draft";
    const createShort =
      typeof body.short_description === "string" ? body.short_description.trim() : "";
    if (createStatus !== "draft" && createShort === "") {
      return fail(SHORT_DESC_REQUIRED_CODE, SHORT_DESC_REQUIRED_MSG, 422);
    }

    // V5.69 Product OS 数据质量硬闸（CREATE 路径）：新建即发布(status != draft)同样必须
    // 带封面图 + 至少一个价格档，否则前台/下单链路残缺。此前只有 UPDATE 路径设闸，
    // POST {status:"active"} 可绕过 → 直接生成一个可下单的残缺商品并返回成功
    // （= 发布成功但闸门本应拦截，违反真实性红线）。与 UPDATE 同口径、同错误码。
    if (createStatus !== "draft") {
      const createCover = typeof body.cover_image === "string" ? body.cover_image.trim() : "";
      if (createCover === "") {
        return fail(
          "COVER_IMAGE_REQUIRED",
          "Cannot publish: cover_image is required for an active product",
          422,
        );
      }
      const createPrices = Array.isArray(body.prices) ? body.prices : [];
      const createQuote = Number(body.quote_required) === 1;
      if (createPrices.length === 0 && !createQuote) {
        return fail(
          "PRICE_TIER_REQUIRED",
          "Cannot publish: an active product needs at least one price tier, or quote_required=1 (Price on Request)",
          422,
        );
      }
    }

    // S19：新建商品强制 title / category 非空——POST {} 不得生成空白商品进目录。
    const createTitle = typeof body.title === "string" ? body.title.trim() : "";
    const createCategory = typeof body.category === "string" ? body.category.trim() : "";
    if (!createTitle) {
      return fail("VALIDATION_ERROR", "title is required to create a product", 422);
    }
    if (!createCategory) {
      return fail("VALIDATION_ERROR", "category is required to create a product", 422);
    }

    // S20：商品 + 变体 + 价格档原子提交，避免半损（如 0 价格档 → 下单 No pricing）。
    const createBatch: D1PreparedStatement[] = [
      db
        .prepare(
          `INSERT INTO commerce_products (id, short_id, product_key, slug, category, title, short_description, description, cover_image, gallery, video_url, status, moq, stock_status, lead_time, unit, certifications, oem_available, source_type, tags, ready_to_ship, quote_required, display_product_code, cost_price, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .bind(
          productId,
          productId.replace(/-/g, "").slice(0, 10),
          productKey,
          slug,
          createCategory,
          createTitle,
          createShort,
          (body.description as string) || "",
          (body.cover_image as string) || "",
          JSON.stringify(body.gallery || []),
          (body.video_url as string) || "",
          (body.status as string) || "draft",
          (body.moq as number) || 1,
          (body.stock_status as string) || "in_stock",
          (body.lead_time as string) || "",
          (body.unit as string) || "pcs",
          JSON.stringify(body.certifications || []),
          (body.oem_available as number) ?? 1,
          (body.source_type as string) || "manual",
          JSON.stringify(body.tags || []),
          (body.ready_to_ship as number) ?? 0,
          (body.quote_required as number) ?? 0,
          (body.display_product_code as string) || "",
          (body.cost_price as number) ?? null,
          now,
          now,
        ),
    ];

    // Insert variants
    if (Array.isArray(body.variants)) {
      for (const v of body.variants as Record<string, unknown>[]) {
        createBatch.push(
          db
            .prepare(
              "INSERT INTO commerce_product_variants (id, product_id, sku, name, options_json, image, stock, status, display_sku_code) VALUES (?,?,?,?,?,?,?,?,?)",
            )
            .bind(
              uid(),
              productId,
              (v.sku as string) || "",
              (v.name as string) || "",
              JSON.stringify(v.options || {}),
              (v.image as string) || "",
              (v.stock as number) ?? null,
              (v.status as string) || "active",
              (v.display_sku_code as string) || null,
            ),
        );
      }
    }
    // Insert prices
    if (Array.isArray(body.prices)) {
      for (const p of body.prices as Record<string, unknown>[]) {
        createBatch.push(
          db
            .prepare(
              "INSERT INTO commerce_price_tiers (id, product_id, variant_id, min_qty, max_qty, unit_price, currency) VALUES (?,?,?,?,?,?,?)",
            )
            .bind(
              uid(),
              productId,
              (p.variant_id as string) || null,
              (p.min_qty as number) || 1,
              (p.max_qty as number) ?? null,
              (p.unit_price as number) || 0,
              (p.currency as string) || "USD",
            ),
        );
      }
    }

    await db.batch(createBatch);

    // Audit D01: draft 允许暂无短描述，但必须显式标记 incomplete。
    return ok({
      id: productId,
      content_status: createShort === "" ? "incomplete" : "complete",
      missing_required_fields: createShort === "" ? ["short_description"] : [],
    });
  }

  // ---- DELETE: soft-delete ----
  if (method === "DELETE") {
    const errDel = requirePermission(user, "commerce", "delete");
    if (errDel) return errDel;

    const id = url.searchParams.get("id");
    if (!id) return fail("VALIDATION_ERROR", "Missing product id", 400);

    const existing = await db
      .prepare("SELECT id FROM commerce_products WHERE id = ? AND deleted_at IS NULL")
      .bind(id)
      .first();
    if (!existing) return fail("NOT_FOUND", "Product not found", 404);

    const now = Math.floor(Date.now() / 1000);
    await db
      .prepare(
        "UPDATE commerce_products SET deleted_at = ?, deleted_by = ?, updated_at = ? WHERE id = ?",
      )
      .bind(now, user!.username, now, id)
      .run();

    return ok({ id, deleted: true });
  }

  return fail("VALIDATION_ERROR", "Method not allowed", 405);
};
