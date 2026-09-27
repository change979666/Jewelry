import type { Order } from "../types";
import type { D1Database } from "@cloudflare/workers-types";

/**
 * Provider-agnostic payment interface. Order core only stores
 * payment_status / provider / provider_reference — never card data.
 */
export interface PaymentProvider {
  readonly code: string;
  createCheckout(
    order: Order,
  ): Promise<{ success: boolean; url?: string; reference?: string; error?: string }>;
  getPaymentStatus(reference: string): Promise<string>;
  handleWebhook(payload: unknown): Promise<boolean>;
  refund(paymentId: string, amount: number): Promise<boolean>;
  cancel(paymentId: string): Promise<boolean>;
}

/** V1: Cash on Delivery. Payment stays `pending` until the order is delivered/settled. */
export class CODProvider implements PaymentProvider {
  readonly code = "cod";
  constructor(private db: D1Database) {}

  async createCheckout(
    order: Order,
  ): Promise<{ success: boolean; url?: string; reference?: string; error?: string }> {
    const paymentId = crypto.randomUUID();
    const reference = `cod_${order.order_number}`;

    await this.db
      .prepare(
        `
      INSERT INTO payments (id, order_id, provider, provider_reference, status, amount, currency)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
      )
      .bind(
        paymentId,
        order.id,
        this.code,
        reference,
        "pending",
        order.total_amount,
        order.currency,
      )
      .run();

    return { success: true, reference };
  }

  async getPaymentStatus(): Promise<string> {
    return "pending"; // COD settles outside the system in V1
  }

  async handleWebhook(): Promise<boolean> {
    return true;
  }

  async refund(): Promise<boolean> {
    return false; // COD refunds are handled manually in V1
  }

  async cancel(paymentId: string): Promise<boolean> {
    await this.db
      .prepare(`UPDATE payments SET status = 'cancelled' WHERE id = ?`)
      .bind(paymentId)
      .run();
    return true;
  }
}

/**
 * Reserved slot for hosted checkout (Stripe / Tabby / Tamara / local PSP).
 * Disabled by feature flag in V1 — the storefront must not render a dead button.
 * When implemented, it runs as a redirect/hosted page; card data never touches D1.
 */
export class HostedCheckoutProvider implements PaymentProvider {
  readonly code = "hosted";
  constructor(
    _db: D1Database,
    private config: { enabled: boolean },
  ) {}

  async createCheckout(): Promise<{
    success: boolean;
    url?: string;
    reference?: string;
    error?: string;
  }> {
    if (!this.config.enabled) return { success: false, error: "online_payment_disabled" };
    return { success: false, error: "hosted_checkout_not_configured" };
  }

  async getPaymentStatus(): Promise<string> {
    return "pending";
  }

  async handleWebhook(): Promise<boolean> {
    return false;
  }

  async refund(): Promise<boolean> {
    return false;
  }

  async cancel(): Promise<boolean> {
    return false;
  }
}
