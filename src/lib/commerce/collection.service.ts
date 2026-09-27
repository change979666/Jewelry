import type { D1Database } from '@cloudflare/workers-types';
import type { Collection, Product } from './types';

const uuid = () => crypto.randomUUID();

export class CollectionService {
  constructor(private db: D1Database) {}

  async listCollections(includeArchived = false): Promise<Collection[]> {
    const where = includeArchived ? '' : ` WHERE status != 'archived'`;
    const { results } = await this.db
      .prepare(`SELECT * FROM collections${where} ORDER BY sort_order ASC, name ASC`)
      .all<Collection>();
    return results || [];
  }

  async getBySlug(slug: string): Promise<Collection | null> {
    return (await this.db.prepare(`SELECT * FROM collections WHERE slug = ?`).bind(slug).first<Collection>()) ?? null;
  }

  async getById(id: string): Promise<Collection | null> {
    return (await this.db.prepare(`SELECT * FROM collections WHERE id = ?`).bind(id).first<Collection>()) ?? null;
  }

  /**
   * Products belonging to a collection (real join, paginated + sortable).
   * Uses idx_collection_products_col_id / idx_collection_products_prod_id.
   */
  async listProducts(params: {
    collectionId: string;
    limit?: number;
    offset?: number;
    sort?: 'newest' | 'price_asc' | 'price_desc' | 'title';
  }): Promise<{ products: Product[]; total: number }> {
    const limit = Math.min(100, Math.max(1, params.limit ?? 24));
    const offset = Math.max(0, params.offset ?? 0);

    let orderSql = ' ORDER BY cp.sort_order ASC, p.created_at DESC';
    if (params.sort === 'price_asc' || params.sort === 'price_desc') {
      orderSql = ` ORDER BY (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'active') IS NULL,
                   (SELECT MIN(v.price) FROM product_variants v WHERE v.product_id = p.id AND v.status = 'active') ${params.sort === 'price_asc' ? 'ASC' : 'DESC'}`;
    } else if (params.sort === 'title') {
      orderSql = ' ORDER BY p.title ASC';
    }

    const totalRow = await this.db
      .prepare(`SELECT COUNT(*) AS c FROM collection_products cp JOIN products p ON p.id = cp.product_id WHERE cp.collection_id = ? AND p.status = 'active'`)
      .bind(params.collectionId)
      .first<{ c: number }>();

    const { results } = await this.db
      .prepare(`SELECT p.* FROM collection_products cp
                JOIN products p ON p.id = cp.product_id
                WHERE cp.collection_id = ? AND p.status = 'active'${orderSql} LIMIT ? OFFSET ?`)
      .bind(params.collectionId, limit, offset)
      .all<Product>();

    return { products: results || [], total: totalRow?.c ?? 0 };
  }

  async create(data: { name: string; slug?: string; description?: string; seo_title?: string; seo_description?: string }): Promise<{ id: string }> {
    const id = uuid();
    await this.db.prepare(`
      INSERT INTO collections (id, slug, name, description, status, seo_title, seo_description, created_at, updated_at)
      VALUES (?,?,?,?, 'draft', ?,?, ?, ?)
    `).bind(id, data.slug?.trim() || id, data.name, data.description ?? null, data.seo_title ?? null, data.seo_description ?? null, new Date().toISOString(), new Date().toISOString()).run();
    return { id };
  }

  async update(id: string, fields: Partial<Collection>): Promise<void> {
    const allowed = ['slug', 'name', 'description', 'status', 'sort_order', 'seo_title', 'seo_description'] as const;
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of allowed) {
      const val = (fields as Record<string, unknown>)[key];
      if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
    }
    if (!sets.length) return;
    sets.push('updated_at = ?');
    values.push(new Date().toISOString(), id);
    await this.db.prepare(`UPDATE collections SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }

  /** Replace the collection's product list atomically (ordered). */
  async setProducts(collectionId: string, productIds: string[]): Promise<void> {
    const batch: D1PreparedStatement[] = [
      this.db.prepare(`DELETE FROM collection_products WHERE collection_id = ?`).bind(collectionId),
    ];
    productIds.forEach((pid, i) => {
      batch.push(this.db.prepare(`INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?,?,?)`).bind(collectionId, pid, i));
    });
    await this.db.batch(batch);
  }

  async addProduct(collectionId: string, productId: string, sortOrder = 0): Promise<void> {
    await this.db.prepare(`INSERT OR IGNORE INTO collection_products (collection_id, product_id, sort_order) VALUES (?,?,?)`).bind(collectionId, productId, sortOrder).run();
  }

  async removeProduct(collectionId: string, productId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM collection_products WHERE collection_id = ? AND product_id = ?`).bind(collectionId, productId).run();
  }
}
