// Jewelry Commerce Core — inventory & checkout claim service
//
// WHY THIS FILE EXISTS (P0-3)
// ---------------------------
// The V1 checkout used to run "read stock → create order → decrement stock".
// Between the read and the write another request could pass the same check, so
// two orders could take the same last unit. The fix is to make the decrement
// *conditional* — the guard lives in the UPDATE's WHERE clause, so it is
// evaluated and applied in a single statement (D1 serialises writes, so a
// conditional UPDATE is the atomic compare-and-set we need).
//
// All-or-nothing: `reserve()` rolls back the lines it already took when any
// line fails, so a multi-line cart never ends up half-reserved.
//
// The cart claim (`claimCart`) is the duplicate-submit guard: `checked_out_at`
// is set with `WHERE checked_out_at IS NULL`, so exactly one of N concurrent
// submits from the same cart wins; the others get `false` and are rejected.

import type { D1Database } from "@cloudflare/workers-types";

export interface ReservationLine {
  variant_id: string;
  quantity: number;
}

export interface ReservationResult {
  ok: boolean;
  /** Variant that could not be reserved (stock taken by someone else). */
  failed_variant_id?: string;
  /** Lines actually reserved — kept for compensation on a later failure. */
  reserved: ReservationLine[];
}

const now = () => new Date().toISOString();

/** Rows touched by a D1 write. */
function changes(result: { meta?: { changes?: number } }): number {
  return result.meta?.changes ?? 0;
}

export class InventoryService {
  constructor(private db: D1Database) {}

  /**
   * Atomically claim stock for every line. All-or-nothing.
   * `deny`-policy variants are decremented only when stock still covers the
   * requested quantity; `continue`-policy (backorder) variants are skipped.
   */
  async reserve(lines: ReservationLine[]): Promise<ReservationResult> {
    const reserved: ReservationLine[] = [];
    for (const line of lines) {
      if (!Number.isInteger(line.quantity) || line.quantity < 1) {
        await this.release(reserved);
        return { ok: false, failed_variant_id: line.variant_id, reserved: [] };
      }
      const res = await this.db
        .prepare(
          `UPDATE product_variants
              SET inventory_quantity = inventory_quantity - ?, updated_at = ?
            WHERE id = ?
              AND status = 'active'
              AND inventory_policy = 'deny'
              AND inventory_quantity >= ?`,
        )
        .bind(line.quantity, now(), line.variant_id, line.quantity)
        .run();

      if (changes(res) === 0) {
        // Either the variant is gone/inactive/backorder, or stock ran out.
        // Non-deny variants are handled by the stock check upstream, so any
        // zero-change here means "cannot honour this line".
        const exists = await this.db
          .prepare(`SELECT inventory_policy, status FROM product_variants WHERE id = ?`)
          .bind(line.variant_id)
          .first<{ inventory_policy: string; status: string }>();
        if (exists && exists.status === "active" && exists.inventory_policy === "continue") {
          continue; // backorder allowed — nothing to reserve
        }
        await this.release(reserved);
        return { ok: false, failed_variant_id: line.variant_id, reserved: [] };
      }
      reserved.push({ ...line });
    }
    return { ok: true, reserved };
  }

  /** Return reserved stock. Used when a later step of checkout fails. */
  async release(lines: ReservationLine[]): Promise<void> {
    for (const line of lines) {
      await this.db
        .prepare(
          `UPDATE product_variants
              SET inventory_quantity = inventory_quantity + ?, updated_at = ?
            WHERE id = ? AND inventory_policy = 'deny'`,
        )
        .bind(line.quantity, now(), line.variant_id)
        .run();
    }
  }

  /**
   * Claim a cart for checkout. Exactly one concurrent submit can win.
   * Returns false when the cart was already used to place an order.
   */
  async claimCart(cartId: string): Promise<boolean> {
    const res = await this.db
      .prepare(
        `UPDATE carts SET checked_out_at = ?, updated_at = ?
          WHERE id = ? AND checked_out_at IS NULL`,
      )
      .bind(now(), now(), cartId)
      .run();
    return changes(res) > 0;
  }

  /** Release a cart claim (compensation when order creation fails). */
  async releaseCart(cartId: string): Promise<void> {
    await this.db
      .prepare(`UPDATE carts SET checked_out_at = NULL, updated_at = ? WHERE id = ?`)
      .bind(now(), cartId)
      .run();
  }
}
