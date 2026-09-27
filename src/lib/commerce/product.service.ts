import type { D1Database } from "@cloudflare/workers-types";
import type {
  Product,
  ProductVariant,
  ProductMedia,
  ProductWithRelations,
  Collection,
} from "./types";

const uuid = () => crypto.randomUUID();

export interface ProductListQuery {
  limit?: number;
  offset?: number;
  status?: string; // default: active
  collectionSlug?: string;
  search?: string; // title / sku / slug (LIKE)
  sort?: "newest" | "price_asc" | "price_desc" | "title";
}

export class ProductService {
  constructor(private db: D1Database) {}

  async listProducts(q: ProductListQuery = {}): Promise<{ products: Product[]; total: number }> {
    const limit = Math.min(100, Math.max(1, q.limit ?? 24));
    const offset = Math.max(0, q.offset ?? 0);
    const status = q.status ?? "active";

    let where = " WHERE 1=1";
    const params: (string | number)[] = [];
    if (status !== "all") {
      where += " AND p.status = ?";
      params.push(status);
    }
    if (q.search) {
      where += " AND (p.title LIKE ? OR p.sku LIKE ? OR p.slug LIKE ?)";
      const like = `%${q.search.slice(0, 40)}%`;
      params.push(like, like, like);
    }
    if (q.collectionSlug) {
      where += ` AND p.id IN (SELECT cp.product_id FROM collection_products cp
                 JOIN collections c ON c.id = cp.collection_id WHERE c.slug = ?)`;
      params.push(q.collectionSlug);
    }

    let orderSql = " ORDER BY p.created_at DESC";
    if (q.sort === "price_asc" || q.sort === "price_desc") {
      orderSql = ` ORDER BY (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'active') IS NULL,
                   (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'active') ${q.sort === "price_asc" ? "ASC" : "DESC"}`;
    } else if (q.sort === "title") {
      orderSql = " ORDER BY p.title ASC";
    }

    const totalRow = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM products p${where}`)
      .bind(...params)
      .first<{ c: number }>();

    const { results } = await this.db
      .prepare(`SELECT p.* FROM products p${where}${orderSql} LIMIT ? OFFSET ?`)
      .bind(...params, limit, offset)
      .all<Product>();

    return { products: results || [], total: totalRow?.c ?? 0 };
  }

  async getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
    const product = await this.db
      .prepare(`SELECT * FROM products WHERE slug = ?`)
      .bind(slug)
      .first<Product>();
    return product ? this.withRelations(product) : null;
  }

  async getProductById(id: string): Promise<ProductWithRelations | null> {
    const product = await this.db
      .prepare(`SELECT * FROM products WHERE id = ?`)
      .bind(id)
      .first<Product>();
    return product ? this.withRelations(product) : null;
  }

  private async withRelations(product: Product): Promise<ProductWithRelations> {
    const variants = await this.db
      .prepare(`SELECT * FROM product_variants WHERE product_id = ? ORDER BY created_at ASC`)
      .bind(product.id)
      .all<ProductVariant>();
    const media = await this.db
      .prepare(
        `SELECT * FROM product_media WHERE product_id = ? ORDER BY sort_order ASC, created_at ASC`,
      )
      .bind(product.id)
      .all<ProductMedia>();
    return { ...product, variants: variants.results || [], media: media.results || [] };
  }

  /**
   * Create a product with its first variant. Price lives on the variant only —
   * products never carry a price column.
   */
  async createProduct(data: {
    title: string;
    slug?: string;
    sku?: string;
    short_description?: string;
    description?: string;
    status?: Product["status"];
    product_type?: string;
    brand?: string;
    material?: string;
    base_material?: string;
    plating?: string;
    color?: string;
    dimensions?: string;
    weight?: string;
    care_instructions?: string;
    size_info?: string;
    country_of_origin?: string;
    seo_title?: string;
    seo_description?: string;
    variant?: {
      sku?: string;
      option_values?: string; // JSON array string
      price: number; // integer minor units
      compare_at_price?: number;
      currency?: string;
      inventory_quantity?: number;
    };
  }): Promise<{ id: string }> {
    const id = uuid();
    const slug = data.slug?.trim() || id;
    const now = new Date().toISOString();
    const v = data.variant;

    const batch: D1PreparedStatement[] = [
      this.db
        .prepare(
          `
        INSERT INTO products (id, slug, sku, title, short_description, description, status,
          product_type, brand, material, base_material, plating, color, dimensions, weight,
          care_instructions, size_info, country_of_origin, seo_title, seo_description, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
      `,
        )
        .bind(
          id,
          slug,
          data.sku ?? null,
          data.title,
          data.short_description ?? null,
          data.description ?? null,
          data.status ?? "draft",
          data.product_type ?? null,
          data.brand ?? null,
          data.material ?? null,
          data.base_material ?? null,
          data.plating ?? null,
          data.color ?? null,
          data.dimensions ?? null,
          data.weight ?? null,
          data.care_instructions ?? null,
          data.size_info ?? null,
          data.country_of_origin ?? null,
          data.seo_title ?? null,
          data.seo_description ?? null,
          now,
          now,
        ),
    ];

    if (v) {
      batch.push(
        this.db
          .prepare(
            `
        INSERT INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)
      `,
          )
          .bind(
            uuid(),
            id,
            v.sku ?? null,
            v.option_values ?? null,
            v.price,
            v.compare_at_price ?? null,
            v.currency ?? "SAR",
            v.inventory_quantity ?? 0,
            "active",
            now,
            now,
          ),
      );
    }

    await this.db.batch(batch);
    return { id };
  }

  /** Update scalar product fields (facts/seo/content/status). Variants are managed via saveVariants. */
  async updateProduct(id: string, fields: Partial<Product>): Promise<void> {
    const allowed = [
      "slug",
      "sku",
      "title",
      "short_description",
      "description",
      "status",
      "product_type",
      "brand",
      "material",
      "base_material",
      "plating",
      "color",
      "dimensions",
      "weight",
      "care_instructions",
      "size_info",
      "country_of_origin",
      "seo_title",
      "seo_description",
      "canonical_url",
      "og_title",
      "og_description",
    ] as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      const val = (fields as Record<string, unknown>)[key];
      if (val !== undefined) {
        sets.push(`${key} = ?`);
        values.push(val);
      }
    }
    if (!sets.length) return;
    sets.push("updated_at = ?");
    values.push(new Date().toISOString(), id);
    await this.db
      .prepare(`UPDATE products SET ${sets.join(", ")} WHERE id = ?`)
      .bind(...values)
      .run();
  }

  /** Replace all variants of a product atomically. */
  async saveVariants(
    productId: string,
    variants: Array<{
      id?: string;
      sku?: string;
      option_values?: string;
      price: number;
      compare_at_price?: number;
      currency?: string;
      inventory_quantity?: number;
      status?: string;
    }>,
  ): Promise<void> {
    const now = new Date().toISOString();
    const batch: D1PreparedStatement[] = [
      this.db.prepare(`DELETE FROM product_variants WHERE product_id = ?`).bind(productId),
    ];
    for (const v of variants) {
      batch.push(
        this.db
          .prepare(
            `
        INSERT INTO product_variants (id, product_id, sku, option_values, price, compare_at_price, currency, inventory_quantity, inventory_policy, status, created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,'deny',?,?,?)
      `,
          )
          .bind(
            v.id && !v.id.startsWith("new-") ? v.id : uuid(),
            productId,
            v.sku ?? null,
            v.option_values ?? null,
            v.price,
            v.compare_at_price ?? null,
            v.currency ?? "SAR",
            v.inventory_quantity ?? 0,
            v.status ?? "active",
            now,
            now,
          ),
      );
    }
    await this.db.batch(batch);
  }

  /** Replace media set atomically. */
  async saveMedia(
    productId: string,
    media: Array<{ id?: string; type?: string; url: string; alt?: string; sort_order?: number }>,
  ): Promise<void> {
    const batch: D1PreparedStatement[] = [
      this.db.prepare(`DELETE FROM product_media WHERE product_id = ?`).bind(productId),
    ];
    let i = 0;
    for (const m of media) {
      batch.push(
        this.db
          .prepare(
            `
        INSERT INTO product_media (id, product_id, type, url, alt, sort_order, created_at)
        VALUES (?,?,?,?,?,?,?)
      `,
          )
          .bind(
            m.id && !m.id.startsWith("new-") ? m.id : uuid(),
            productId,
            m.type ?? "gallery",
            m.url,
            m.alt ?? null,
            m.sort_order ?? i++,
            new Date().toISOString(),
          ),
      );
    }
    await this.db.batch(batch);
  }

  /** Replace collection assignments atomically. */
  async saveCollections(productId: string, collectionIds: string[]): Promise<void> {
    const batch: D1PreparedStatement[] = [
      this.db.prepare(`DELETE FROM collection_products WHERE product_id = ?`).bind(productId),
    ];
    for (const cid of collectionIds) {
      batch.push(
        this.db
          .prepare(
            `INSERT OR IGNORE INTO collection_products (collection_id, product_id) VALUES (?,?)`,
          )
          .bind(cid, productId),
      );
    }
    await this.db.batch(batch);
  }

  async listCollections(status = "active"): Promise<Collection[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM collections WHERE status = ? ORDER BY sort_order ASC, name ASC`)
      .bind(status)
      .all<Collection>();
    return results || [];
  }
}
