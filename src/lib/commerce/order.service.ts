import type { D1Database } from '@cloudflare/workers-types';
import type { Order, OrderItem, OrderAddress, OrderEvent, OrderStatus, Shipment } from './types';

const uuid = () => crypto.randomUUID();

/**
 * Single source of truth for legal order transitions.
 * Normal: PENDING_CONFIRMATION → CONFIRMED → PROCESSING → SHIPPED → OUT_FOR_DELIVERY → DELIVERED
 * Exception paths: CANCELLED / DELIVERY_FAILED / NDR / RTO / RETURNED / REFUNDED
 */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_CONFIRMATION: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PROCESSING', 'CANCELLED'],
  PROCESSING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: ['OUT_FOR_DELIVERY'],
  OUT_FOR_DELIVERY: ['DELIVERED', 'DELIVERY_FAILED', 'NDR'],
  DELIVERY_FAILED: ['OUT_FOR_DELIVERY', 'RTO', 'CANCELLED'],
  NDR: ['OUT_FOR_DELIVERY', 'RTO', 'CANCELLED'],
  DELIVERED: ['RETURNED'],
  RTO: ['REFUNDED'],
  RETURNED: ['REFUNDED'],
  REFUNDED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return (ORDER_TRANSITIONS[from] ?? []).includes(to);
}

export interface CreateOrderInput {
  customer_id?: string | null;
  session_id?: string | null;
  market: string;
  currency: string;
  subtotal: number;        // server-calculated minor units
  discount_amount?: number;
  discount_code?: string | null;
  shipping_amount: number; // server-calculated minor units
  tax_amount: number;      // server-calculated minor units
  items: Array<{
    product_id: string;
    variant_id: string;
    sku: string | null;
    title: string;
    unit_price: number;    // server-read variant price
    quantity: number;
    product_snapshot?: unknown;
    personalization_type?: string | null;
    personalization_value?: string | null;
  }>;
  shipping_address: {
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    country?: string | null;
    region?: string | null;
    city?: string | null;
    district?: string | null;
    address_line_1?: string | null;
    address_line_2?: string | null;
    postal_code?: string | null;
    additional_info?: string | null;
  };
}

export class OrderService {
  constructor(private db: D1Database) {}

  private generateOrderNumber(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no ambiguous chars
    let result = 'JW-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Create order + items + address snapshot + initial event in ONE transaction.
   * Prices passed here MUST already be server-recalculated by checkout.
   */
  async createOrder(data: CreateOrderInput): Promise<Order> {
    const id = uuid();
    const orderNumber = this.generateOrderNumber();
    const total = data.subtotal - (data.discount_amount ?? 0) + data.shipping_amount + data.tax_amount;
    const now = new Date().toISOString();
    const addr = data.shipping_address;

    const batch: D1PreparedStatement[] = [
      this.db.prepare(`
        INSERT INTO orders (id, order_number, customer_id, session_id, market, currency,
          subtotal, discount_amount, discount_code, shipping_amount, tax_amount, total_amount,
          order_status, payment_status, fulfillment_status, delivery_status, confirmation_status,
          created_at, updated_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?, 'PENDING_CONFIRMATION','PENDING','UNFULFILLED','PENDING','UNCONFIRMED',?,?)
      `).bind(
        id, orderNumber, data.customer_id ?? null, data.session_id ?? null,
        data.market, data.currency, data.subtotal, data.discount_amount ?? 0,
        data.discount_code ?? null, data.shipping_amount, data.tax_amount, total, now, now,
      ),
      this.db.prepare(`
        INSERT INTO order_addresses (id, order_id, type, first_name, last_name, phone, country, region, city, district, address_line_1, address_line_2, postal_code, additional_info)
        VALUES (?,?, 'shipping', ?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        uuid(), id, addr.first_name ?? null, addr.last_name ?? null, addr.phone ?? null,
        addr.country ?? null, addr.region ?? null, addr.city ?? null, addr.district ?? null,
        addr.address_line_1 ?? null, addr.address_line_2 ?? null, addr.postal_code ?? null,
        addr.additional_info ?? null,
      ),
      this.db.prepare(`
        INSERT INTO order_events (id, order_id, status, description) VALUES (?,?,?,?)
      `).bind(uuid(), id, 'PENDING_CONFIRMATION', 'Order placed (COD)'),
    ];

    for (const item of data.items) {
      batch.push(this.db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, variant_id, sku, title, unit_price, quantity, line_total, product_snapshot, personalization_type, personalization_value)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
      `).bind(
        uuid(), id, item.product_id, item.variant_id, item.sku, item.title,
        item.unit_price, item.quantity, item.unit_price * item.quantity,
        JSON.stringify(item.product_snapshot ?? {}),
        item.personalization_type ?? null, item.personalization_value ?? null,
      ));
    }

    await this.db.batch(batch);
    const order = await this.getOrder(id);
    if (!order) throw new Error('order_create_failed');
    return order;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    return (await this.db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<Order>()) ?? null;
  }

  async getOrderByNumber(orderNumber: string): Promise<Order | null> {
    return (await this.db.prepare(`SELECT * FROM orders WHERE order_number = ?`).bind(orderNumber).first<Order>()) ?? null;
  }

  async getOrderItems(orderId: string): Promise<OrderItem[]> {
    const { results } = await this.db.prepare(`SELECT * FROM order_items WHERE order_id = ? ORDER BY created_at ASC`).bind(orderId).all<OrderItem>();
    return results || [];
  }

  async getOrderAddress(orderId: string): Promise<OrderAddress | null> {
    return (await this.db.prepare(`SELECT * FROM order_addresses WHERE order_id = ? AND type = 'shipping'`).bind(orderId).first<OrderAddress>()) ?? null;
  }

  async getOrderEvents(orderId: string): Promise<OrderEvent[]> {
    const { results } = await this.db.prepare(`SELECT * FROM order_events WHERE order_id = ? ORDER BY created_at DESC`).bind(orderId).all<OrderEvent>();
    return results || [];
  }

  /**
   * Legal-transition-only status update. Direct `UPDATE orders SET status=...`
   * outside this method is forbidden for business flows.
   */
  async updateOrderStatus(orderId: string, status: OrderStatus, reason?: string, actor = 'admin'): Promise<{ ok: boolean; error?: string }> {
    const order = await this.getOrder(orderId);
    if (!order) return { ok: false, error: 'order_not_found' };
    if (!canTransition(order.order_status as OrderStatus, status)) {
      return { ok: false, error: `illegal_transition:${order.order_status}->${status}` };
    }

    const now = new Date().toISOString();
    const batch: D1PreparedStatement[] = [
      this.db.prepare(`UPDATE orders SET order_status = ?, updated_at = ? WHERE id = ?`).bind(status, now, orderId),
      this.db.prepare(`INSERT INTO order_events (id, order_id, status, description) VALUES (?,?,?,?)`)
        .bind(uuid(), orderId, status, reason || `Status updated by ${actor}`),
    ];

    // Fulfillment bookkeeping: create the manual shipment when the order ships.
    if (status === 'SHIPPED') {
      batch.push(this.db.prepare(`
        INSERT INTO shipments (id, order_id, provider, carrier, status, shipped_at)
        VALUES (?,?, 'manual', NULL, 'shipped', ?)
      `).bind(uuid(), orderId, now));
      batch.push(this.db.prepare(`UPDATE orders SET fulfillment_status = 'SHIPPED' WHERE id = ?`).bind(orderId));
    }
    if (status === 'DELIVERED') {
      batch.push(this.db.prepare(`UPDATE shipments SET status = 'delivered', delivered_at = ? WHERE order_id = ?`).bind(now, orderId));
      batch.push(this.db.prepare(`UPDATE orders SET fulfillment_status = 'DELIVERED', delivery_status = 'DELIVERED' WHERE id = ?`).bind(orderId));
    }
    if (status === 'CANCELLED') {
      batch.push(this.db.prepare(`UPDATE orders SET confirmation_status = 'CANCELLED' WHERE id = ?`).bind(orderId));
    }

    await this.db.batch(batch);
    return { ok: true };
  }

  async addOrderEvent(orderId: string, status: string, description: string): Promise<void> {
    await this.db.prepare(`
      INSERT INTO order_events (id, order_id, status, description) VALUES (?,?,?,?)
    `).bind(uuid(), orderId, status, description).run();
  }

  async getShipments(orderId: string): Promise<Shipment[]> {
    const { results } = await this.db.prepare(`SELECT * FROM shipments WHERE order_id = ? ORDER BY created_at ASC`).bind(orderId).all<Shipment>();
    return results || [];
  }

  async updateShipment(shipmentId: string, fields: Partial<Pick<Shipment, 'carrier' | 'tracking_number' | 'tracking_url' | 'status'>>): Promise<void> {
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const key of ['carrier', 'tracking_number', 'tracking_url', 'status'] as const) {
      const val = fields[key];
      if (val !== undefined) { sets.push(`${key} = ?`); values.push(val); }
    }
    if (!sets.length) return;
    values.push(shipmentId);
    await this.db.prepare(`UPDATE shipments SET ${sets.join(', ')} WHERE id = ?`).bind(...values).run();
  }
}
