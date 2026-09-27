import type { D1Database } from '@cloudflare/workers-types';
import type { Order, OrderItem, OrderAddress, OrderEvent } from './types';

export class OrderService {
  constructor(private db: D1Database) {}

  private generateOrderNumber(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = 'JW-';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  async createOrder(data: {
    customer_id?: string;
    session_id?: string;
    market: string;
    currency: string;
    subtotal: number;
    shipping_amount: number;
    tax_amount: number;
    items: any[];
    shipping_address: any;
  }): Promise<Order> {
    const id = crypto.randomUUID();
    const order_number = this.generateOrderNumber();
    const total_amount = data.subtotal + data.shipping_amount + data.tax_amount;

    await this.db.prepare(`
      INSERT INTO orders (id, order_number, customer_id, session_id, market, currency, subtotal, shipping_amount, tax_amount, total_amount)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      id, order_number, data.customer_id || null, data.session_id || null,
      data.market, data.currency, data.subtotal, data.shipping_amount, data.tax_amount, total_amount
    ).run();

    // Insert Items
    for (const item of data.items) {
      const itemId = crypto.randomUUID();
      await this.db.prepare(`
        INSERT INTO order_items (id, order_id, product_id, variant_id, sku, title, unit_price, quantity, line_total, product_snapshot)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        itemId, id, item.product_id, item.variant_id, item.sku, item.title,
        item.unit_price, item.quantity, item.unit_price * item.quantity, JSON.stringify(item.product_snapshot || {})
      ).run();
    }

    // Insert Address
    const addrId = crypto.randomUUID();
    await this.db.prepare(`
      INSERT INTO order_addresses (id, order_id, type, first_name, last_name, phone, country, city, address_line_1)
      VALUES (?, ?, 'shipping', ?, ?, ?, ?, ?, ?)
    `).bind(
      addrId, id, data.shipping_address.first_name, data.shipping_address.last_name,
      data.shipping_address.phone, data.shipping_address.country, data.shipping_address.city,
      data.shipping_address.address_line_1
    ).run();

    // Log Event
    await this.addOrderEvent(id, 'PENDING_CONFIRMATION', 'Order placed');

    return this.getOrder(id) as Promise<Order>;
  }

  async getOrder(orderId: string): Promise<Order | null> {
    const order = await this.db.prepare(`SELECT * FROM orders WHERE id = ?`).bind(orderId).first<Order>();
    return order || null;
  }

  async updateOrderStatus(orderId: string, status: string, reason?: string): Promise<void> {
    const order = await this.getOrder(orderId);
    if (!order) throw new Error("Order not found");

    const validTransitions: Record<string, string[]> = {
      'PENDING_CONFIRMATION': ['CONFIRMED', 'CANCELLED'],
      'CONFIRMED': ['PROCESSING', 'CANCELLED'],
      'PROCESSING': ['SHIPPED', 'CANCELLED'],
      'SHIPPED': ['OUT_FOR_DELIVERY', 'RETURNED'],
      'OUT_FOR_DELIVERY': ['DELIVERED', 'DELIVERY_FAILED', 'NDR'],
      'DELIVERY_FAILED': ['OUT_FOR_DELIVERY', 'RTO', 'CANCELLED'],
      'NDR': ['OUT_FOR_DELIVERY', 'RTO', 'CANCELLED']
    };

    const allowed = validTransitions[order.order_status] || [];
    if (!allowed.includes(status)) {
      throw new Error(`Invalid transition from ${order.order_status} to ${status}`);
    }

    await this.db.prepare(`UPDATE orders SET order_status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).bind(status, orderId).run();
    await this.addOrderEvent(orderId, status, reason || 'Status updated manually');
  }

  async addOrderEvent(orderId: string, status: string, description: string): Promise<void> {
    const id = crypto.randomUUID();
    await this.db.prepare(`
      INSERT INTO order_events (id, order_id, status, description) VALUES (?, ?, ?, ?)
    `).bind(id, orderId, status, description).run();
  }
}
