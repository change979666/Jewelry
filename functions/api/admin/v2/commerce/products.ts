// Jewelry V1.0 — Admin Products API (Jewelry schema only, ProductService-backed)
// GET    /api/admin/v2/commerce/products            → list (search/filter/sort/paginate)
// GET    /api/admin/v2/commerce/products?id=x       → detail (variants + media + collections)
// POST   /api/admin/v2/commerce/products            → create (no id) / update (with id)
// DELETE /api/admin/v2/commerce/products?id=x       → archive (soft delete)
//
// 价格只存在于 product_variants.price（integer minor units）；products 表永无 price 列。
// 发布闸门：active 商品必须有标题 + 至少一个含价格的 active 变体。

import type { AdminEnv } from "../../../admin/shared";
import { authenticateRequest, requirePermission } from "../../../../lib/admin/rbac";
import { ProductService } from "../../../../../src/lib/commerce/product.service";
import type { ProductStatus } from "../../../../../src/lib/commerce/types";
import { logAction } from "../../../../lib/admin/audit";

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

const SORT_WHITELIST = ["created_at", "title", "status", "price_asc", "price_desc"] as const;

export const onRequest: PagesFunction<AdminEnv> = async ({ request, env }) => {
  const user = await authenticateRequest(request, env);
  const err = requirePermission(user, "commerce", "view");
  if (err) return err;

  const db = env.DB!;
  const products = new ProductService(db);
  const url = new URL(request.url);
  const method = request.method;

  // ---- GET: detail or list ----
  if (method === "GET") {
    const id = url.searchParams.get("id");
    if (id) {
      const product = await products.getProductById(id);
      if (!product) return fail("NOT_FOUND", "Product not found", 404);
      const collections = await db
        .prepare(
          `SELECT c.id, c.slug, c.title FROM collections c
           JOIN collection_products cp ON cp.collection_id = c.id
           WHERE cp.product_id = ?`,
        )
        .bind(id)
        .all();
      return ok({ ...product, collections: collections.results || [] });
    }

    const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize")) || 20));
    const status = url.searchParams.get("status") || "all";
    const search = (url.searchParams.get("search") || "").trim();
    const sortParam = url.searchParams.get("sort") || "created_at";
    const sort = (SORT_WHITELIST as readonly string[]).includes(sortParam)
      ? (sortParam as (typeof SORT_WHITELIST)[number])
      : "created_at";

    const { products: rows, total } = await products.listProducts({
      limit: pageSize,
      offset: (page - 1) * pageSize,
      status,
      search,
      sort: sort === "title" || sort === "price_asc" || sort === "price_desc" ? sort : "newest",
    });

    // 每页 bounded 变体价格汇总（无 N+1）
    const priceRows = rows.length
      ? await db
          .prepare(
            `SELECT product_id, MIN(price) AS min_price, MAX(price) AS max_price,
                    SUM(inventory_quantity) AS total_inventory
             FROM product_variants WHERE product_id IN (${rows.map(() => "?").join(",")})
             GROUP BY product_id`,
          )
          .bind(...rows.map((r) => r.id))
          .all<{ product_id: string; min_price: number | null; max_price: number | null; total_inventory: number | null }>()
      : { results: [] as never[] };
    const priceMap = new Map((priceRows.results || []).map((r) => [r.product_id, r]));

    const statusRows = await db
      .prepare("SELECT status, COUNT(*) AS c FROM products GROUP BY status")
      .all<{ status: string; c: number }>();
    const statusCounts: Record<string, number> = {};
    for (const r of statusRows.results || []) statusCounts[r.status] = r.c;

    const data = rows.map((p) => {
      const price = priceMap.get(p.id);
      return {
        ...p,
        min_price: price?.min_price ?? null,
        max_price: price?.max_price ?? null,
        total_inventory: price?.total_inventory ?? 0,
      };
    });

    return ok(data, {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      statusCounts,
    });
  }

  // ---- POST: create or update ----
  if (method === "POST") {
    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return fail("VALIDATION_ERROR", "Invalid JSON", 400);
    }
    const id = body.id as string | undefined;

    if (!id) {
      // ---- Create ----
      const errCreate = requirePermission(user, "commerce", "create");
      if (errCreate) return errCreate;

      const title = typeof body.title === "string" ? body.title.trim() : "";
      if (!title) return fail("VALIDATION_ERROR", "title is required to create a product", 422);
      const status = (body.status as ProductStatus) || "draft";
      const price = body.price != null ? Math.round(Number(body.price)) : null;
      if (status === "active" && (price == null || !Number.isFinite(price) || price <= 0)) {
        return fail(
          "PRICE_REQUIRED",
          "Cannot publish: an active product needs a variant price (minor units, > 0)",
          422,
        );
      }

      const { id: productId } = await products.createProduct({
        title,
        slug: (body.slug as string) || undefined,
        sku: (body.sku as string) || undefined,
        short_description: (body.short_description as string) || undefined,
        description: (body.description as string) || undefined,
        status,
        product_type: (body.product_type as string) || undefined,
        brand: (body.brand as string) || undefined,
        material: (body.material as string) || undefined,
        ...(price != null
          ? {
              variant: {
                sku: (body.sku as string) || undefined,
                price,
                compare_at_price:
                  body.compare_at_price != null ? Math.round(Number(body.compare_at_price)) : undefined,
                currency: (body.currency as string) || "SAR",
                inventory_quantity:
                  body.inventory_quantity != null ? Math.max(0, Math.round(Number(body.inventory_quantity))) : 0,
              },
            }
          : {}),
      });

      await logAction(env, {
        actor_type: "human",
        user_id: user!.id,
        username: user!.username,
        action: "product_created",
        resource_type: "product",
        resource_id: productId,
        change_summary: `created product "${title}" (status=${status})`,
      });

      return ok({ id: productId });
    }

    // ---- Update ----
    const errEdit = requirePermission(user, "commerce", "edit");
    if (errEdit) return errEdit;

    const existing = await products.getProductById(id);
    if (!existing) return fail("NOT_FOUND", "Product not found", 404);

    const scalarFields: Record<string, unknown> = {};
    for (const f of [
      "slug", "sku", "title", "short_description", "description", "status",
      "product_type", "brand", "material", "base_material", "plating", "color",
      "dimensions", "weight", "care_instructions", "size_info", "country_of_origin",
      "seo_title", "seo_description",
    ] as const) {
      if (f in body) scalarFields[f] = body[f];
    }

    // 发布闸门：转为 active 时必须已存在含价格的 active 变体（本次提交或库内）。
    if (scalarFields.status === "active" && existing.status !== "active") {
      const priceRow = await db
        .prepare(
          `SELECT COUNT(*) AS c FROM product_variants WHERE product_id = ? AND status = 'active' AND price > 0`,
        )
        .bind(id)
        .first<{ c: number }>();
      const incomingVariants = Array.isArray(body.variants) ? body.variants : [];
      const incomingHasPrice = incomingVariants.some(
        (v) => Number((v as Record<string, unknown>).price) > 0,
      );
      if (!(Number(priceRow?.c || 0) > 0) && !incomingHasPrice) {
        return fail(
          "PRICE_REQUIRED",
          "Cannot publish: an active product needs at least one variant with price > 0",
          422,
        );
      }
    }

    if (Object.keys(scalarFields).length > 0) {
      await products.updateProduct(id, scalarFields);
    }
    if (Array.isArray(body.variants)) {
      await products.saveVariants(
        id,
        body.variants as Array<{
          id?: string;
          sku?: string;
          option_values?: string;
          price: number;
          compare_at_price?: number;
          currency?: string;
          inventory_quantity?: number;
          status?: string;
        }>,
      );
    }
    if (Array.isArray(body.media)) {
      await products.saveMedia(
        id,
        body.media as Array<{ id?: string; type?: string; url: string; alt?: string; sort_order?: number }>,
      );
    }
    if (Array.isArray(body.collectionIds)) {
      await products.saveCollections(id, body.collectionIds as string[]);
    }

    await logAction(env, {
      actor_type: "human",
      user_id: user!.id,
      username: user!.username,
      action: "product_updated",
      resource_type: "product",
      resource_id: id,
      change_summary: `updated product "${String(scalarFields.title ?? existing.title)}"`,
    });

    return ok({ id });
  }

  // ---- DELETE: archive (soft) ----
  if (method === "DELETE") {
    const errDel = requirePermission(user, "commerce", "delete");
    if (errDel) return errDel;

    const id = url.searchParams.get("id");
    if (!id) return fail("VALIDATION_ERROR", "Missing product id", 400);

    const existing = await products.getProductById(id);
    if (!existing) return fail("NOT_FOUND", "Product not found", 404);

    await products.updateProduct(id, { status: "archived" as ProductStatus });

    await logAction(env, {
      actor_type: "human",
      user_id: user!.id,
      username: user!.username,
      action: "product_archived",
      resource_type: "product",
      resource_id: id,
      change_summary: `archived product "${existing.title}"`,
    });

    return ok({ id, archived: true });
  }

  return fail("METHOD_NOT_ALLOWED", "Method not allowed", 405);
};
