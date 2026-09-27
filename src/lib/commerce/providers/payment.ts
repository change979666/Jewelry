import type { Order, Payment } from '../types';
import type { D1Database } from '@cloudflare/workers-types';

export interface PaymentProvider {
  createCheckout(order: Order): Promise<{ success: boolean; url?: string; reference?: string; error?: string }>;
  getPaymentStatus(reference: string): Promise<string>;
  handleWebhook(payload: any): Promise<boolean>;
  refund(paymentId: string, amount: number): Promise<boolean>;
  cancel(paymentId: string): Promise<boolean>;
}

export class CODProvider implements PaymentProvider {
  constructor(private db: D1Database) {}

  async createCheckout(order: Order): Promise<{ success: boolean; url?: string; reference?: string; error?: string }> {
    const paymentId = crypto.randomUUID();
    const reference = `cod_${order.order_number}`;
    
    await this.db.prepare(`
      INSERT INTO payments (id, order_id, provider, provider_reference, status, amount, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      paymentId,
      order.id,
      'cod',
      reference,
      'pending',
      order.total_amount,
      order.currency
    ).run();

    return {
      success: true,
      reference
    };
  }

  async getPaymentStatus(reference: string): Promise<string> {
    return 'pending'; // COD is always pending until delivered
  }

  async handleWebhook(payload: any): Promise<boolean> {
    return true; 
  }

  async refund(paymentId: string, amount: number): Promise<boolean> {
    return false; // Can't refund COD digitally
  }

  async cancel(paymentId: string): Promise<boolean> {
    await this.db.prepare(`UPDATE payments SET status = 'cancelled' WHERE id = ?`).bind(paymentId).run();
    return true;
  }
}
