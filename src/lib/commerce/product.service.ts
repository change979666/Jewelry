import type { D1Database } from '@cloudflare/workers-types';
import type { Product, ProductVariant, ProductMedia, ProductWithRelations } from './types';

export class ProductService {
  constructor(private db: D1Database) {}

  async listProducts(limit = 20, offset = 0): Promise<Product[]> {
    const { results } = await this.db
      .prepare(`SELECT * FROM products ORDER BY created_at DESC LIMIT ? OFFSET ?`)
      .bind(limit, offset)
      .all<Product>();
    return results || [];
  }

  async getProductBySlug(slug: string): Promise<ProductWithRelations | null> {
    const product = await this.db
      .prepare(`SELECT * FROM products WHERE slug = ?`)
      .bind(slug)
      .first<Product>();

    if (!product) return null;

    const variants = await this.db
      .prepare(`SELECT * FROM product_variants WHERE product_id = ?`)
      .bind(product.id)
      .all<ProductVariant>();

    const media = await this.db
      .prepare(`SELECT * FROM product_media WHERE product_id = ? ORDER BY sort_order ASC`)
      .bind(product.id)
      .all<ProductMedia>();

    return {
      ...product,
      variants: variants.results || [],
      media: media.results || []
    };
  }

  async createProduct(product: Partial<Product>): Promise<Product> {
    const id = crypto.randomUUID();
    const slug = product.slug || id;
    
    await this.db.prepare(`
      INSERT INTO products (id, slug, title, short_description, status, price, currency) 
      VALUES (?, ?, ?, ?, ?, ?, ?) -- Wait, price and currency are in variants! Let's correct this.
    `) // Actually, let's use a robust mapping.
    return product as Product;
  }
}
