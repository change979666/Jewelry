import type { D1Database } from '@cloudflare/workers-types';
import type { Cart, CartItem, Product, ProductVariant } from './types';

export class CartService {
  constructor(private db: D1Database) {}

  async createCart(sessionId: string, customerId?: string, currency = 'SAR'): Promise<Cart> {
    const id = crypto.randomUUID();
    await this.db.prepare(`
      INSERT INTO carts (id, customer_id, session_id, currency)
      VALUES (?, ?, ?, ?)
    `).bind(id, customerId || null, sessionId, currency).run();

    return { id, customer_id: customerId || null, session_id: sessionId, currency, created_at: '', updated_at: '' };
  }

  async getCart(cartId: string): Promise<{ cart: Cart, items: (CartItem & { product: Product, variant: ProductVariant })[] } | null> {
    const cart = await this.db.prepare(`SELECT * FROM carts WHERE id = ?`).bind(cartId).first<Cart>();
    if (!cart) return null;

    const { results } = await this.db.prepare(`
      SELECT ci.*, 
             p.title as p_title, p.slug as p_slug, p.status as p_status,
             v.price as v_price, v.compare_at_price as v_compare_at_price, v.sku as v_sku, v.option_values as v_option_values
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN product_variants v ON ci.variant_id = v.id
      WHERE ci.cart_id = ?
    `).bind(cartId).all<any>();

    const items = (results || []).map(row => ({
      id: row.id,
      cart_id: row.cart_id,
      product_id: row.product_id,
      variant_id: row.variant_id,
      quantity: row.quantity,
      created_at: row.created_at,
      updated_at: row.updated_at,
      product: {
        id: row.product_id,
        slug: row.p_slug,
        title: row.p_title,
        status: row.p_status
      } as Product,
      variant: {
        id: row.variant_id,
        sku: row.v_sku,
        price: row.v_price,
        compare_at_price: row.v_compare_at_price,
        option_values: row.v_option_values
      } as ProductVariant
    }));

    return { cart, items };
  }

  async addItem(cartId: string, productId: string, variantId: string, quantity: number): Promise<void> {
    const existing = await this.db.prepare(`
      SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?
    `).bind(cartId, variantId).first<{ id: string, quantity: number }>();

    if (existing) {
      await this.db.prepare(`
        UPDATE cart_items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `).bind(quantity, existing.id).run();
    } else {
      const id = crypto.randomUUID();
      await this.db.prepare(`
        INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity)
        VALUES (?, ?, ?, ?, ?)
      `).bind(id, cartId, productId, variantId, quantity).run();
    }
    
    await this.db.prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(cartId).run();
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.db.prepare(`DELETE FROM cart_items WHERE id = ?`).bind(itemId).run();
    } else {
      await this.db.prepare(`UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(quantity, itemId).run();
    }
  }

  async removeItem(itemId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM cart_items WHERE id = ?`).bind(itemId).run();
  }
}
