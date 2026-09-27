import type { D1Database } from "@cloudflare/workers-types";
import type { Cart, CartItem, Product, ProductVariant } from "./types";

export interface CartLine extends CartItem {
  product: Pick<Product, "id" | "slug" | "title" | "status">;
  variant: Pick<
    ProductVariant,
    | "id"
    | "sku"
    | "price"
    | "compare_at_price"
    | "option_values"
    | "currency"
    | "inventory_quantity"
    | "status"
  >;
}

export interface CartWithLines {
  cart: Cart;
  items: CartLine[];
}

const uuid = () => crypto.randomUUID();

export class CartService {
  constructor(private db: D1Database) {}

  async createCart(sessionId: string, customerId?: string, currency = "SAR"): Promise<Cart> {
    const id = uuid();
    await this.db
      .prepare(
        `
      INSERT INTO carts (id, customer_id, session_id, currency)
      VALUES (?, ?, ?, ?)
    `,
      )
      .bind(id, customerId || null, sessionId, currency)
      .run();

    return {
      id,
      customer_id: customerId || null,
      session_id: sessionId,
      currency,
      created_at: "",
      updated_at: "",
    };
  }

  /** Unified entry: get (or lazily create) the anonymous cart for a session.
   *  Carts already claimed by checkout (`checked_out_at` set) are never reused —
   *  a new cart is opened instead, so the shopper starts from an empty basket. */
  async getCartBySessionId(sessionId: string, currency = "SAR"): Promise<CartWithLines> {
    let cart = await this.db
      .prepare(
        `SELECT * FROM carts
          WHERE session_id = ? AND checked_out_at IS NULL
          ORDER BY created_at DESC LIMIT 1`,
      )
      .bind(sessionId)
      .first<Cart>();
    if (!cart) {
      cart = await this.createCart(sessionId, undefined, currency);
    }
    return this.getCart(cart.id) as Promise<CartWithLines>;
  }

  async getCart(cartId: string): Promise<CartWithLines | null> {
    const cart = await this.db
      .prepare(`SELECT * FROM carts WHERE id = ?`)
      .bind(cartId)
      .first<Cart>();
    if (!cart) return null;

    const { results } = await this.db
      .prepare(
        `
      SELECT ci.id, ci.cart_id, ci.product_id, ci.variant_id, ci.quantity, ci.created_at, ci.updated_at,
             p.slug AS p_slug, p.title AS p_title, p.status AS p_status,
             v.sku AS v_sku, v.price AS v_price, v.compare_at_price AS v_compare_at_price,
             v.option_values AS v_option_values, v.currency AS v_currency,
             v.inventory_quantity AS v_inventory, v.status AS v_status
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      JOIN product_variants v ON ci.variant_id = v.id
      WHERE ci.cart_id = ?
      ORDER BY ci.created_at ASC
    `,
      )
      .bind(cartId)
      .all<Record<string, unknown>>();

    const items: CartLine[] = (results || []).map((row) => ({
      id: row.id as string,
      cart_id: row.cart_id as string,
      product_id: row.product_id as string,
      variant_id: row.variant_id as string,
      quantity: row.quantity as number,
      created_at: row.created_at as string,
      updated_at: row.updated_at as string,
      product: {
        id: row.product_id as string,
        slug: row.p_slug as string,
        title: row.p_title as string,
        status: row.p_status as Product["status"],
      },
      variant: {
        id: row.variant_id as string,
        sku: row.v_sku as string | null,
        price: row.v_price as number,
        compare_at_price: row.v_compare_at_price as number | null,
        option_values: row.v_option_values as string | null,
        currency: row.v_currency as string,
        inventory_quantity: row.v_inventory as number,
        status: row.v_status as ProductVariant["status"],
      },
    }));

    return { cart, items };
  }

  /**
   * Server-side add with validation. The variant must belong to the product,
   * both must be active, and (policy=deny) stock must cover the requested quantity.
   */
  async addItem(
    cartId: string,
    productId: string,
    variantId: string,
    quantity: number,
  ): Promise<{ ok: boolean; error?: string }> {
    if (!Number.isInteger(quantity) || quantity < 1)
      return { ok: false, error: "invalid_quantity" };

    const variant = await this.db
      .prepare(
        `
      SELECT v.*, p.status AS p_status FROM product_variants v
      JOIN products p ON p.id = v.product_id
      WHERE v.id = ? AND v.product_id = ?
    `,
      )
      .bind(variantId, productId)
      .first<ProductVariant & { p_status: string }>();

    if (!variant) return { ok: false, error: "variant_not_found" };
    if (variant.p_status !== "active" || variant.status !== "active")
      return { ok: false, error: "inactive" };
    if (variant.inventory_policy === "deny") {
      const existing = await this.db
        .prepare(
          `
        SELECT COALESCE(SUM(quantity), 0) AS q FROM cart_items WHERE cart_id = ? AND variant_id = ?
      `,
        )
        .bind(cartId, variantId)
        .first<{ q: number }>();
      if ((existing?.q ?? 0) + quantity > variant.inventory_quantity) {
        return { ok: false, error: "out_of_stock" };
      }
    }

    const row = await this.db
      .prepare(
        `
      SELECT id, quantity FROM cart_items WHERE cart_id = ? AND variant_id = ?
    `,
      )
      .bind(cartId, variantId)
      .first<{ id: string; quantity: number }>();

    if (row) {
      await this.db
        .prepare(
          `
        UPDATE cart_items SET quantity = quantity + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
      `,
        )
        .bind(quantity, row.id)
        .run();
    } else {
      await this.db
        .prepare(
          `
        INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity)
        VALUES (?, ?, ?, ?, ?)
      `,
        )
        .bind(uuid(), cartId, productId, variantId, quantity)
        .run();
    }

    await this.db
      .prepare(`UPDATE carts SET updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
      .bind(cartId)
      .run();
    return { ok: true };
  }

  async updateItemQuantity(itemId: string, quantity: number): Promise<void> {
    if (quantity <= 0) {
      await this.db.prepare(`DELETE FROM cart_items WHERE id = ?`).bind(itemId).run();
    } else {
      await this.db
        .prepare(`UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`)
        .bind(Math.min(quantity, 999), itemId)
        .run();
    }
  }

  async removeItem(itemId: string): Promise<void> {
    await this.db.prepare(`DELETE FROM cart_items WHERE id = ?`).bind(itemId).run();
  }

  async clearCart(cartId: string): Promise<void> {
    await this.db.batch([
      this.db.prepare(`DELETE FROM cart_items WHERE cart_id = ?`).bind(cartId),
      this.db.prepare(`DELETE FROM carts WHERE id = ?`).bind(cartId),
    ]);
  }
}
