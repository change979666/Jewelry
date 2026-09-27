// Jewelry Commerce Core — server-side pricing (pure functions, integer minor units)
//
// SECURITY: client-submitted prices/subtotals/discounts/shipping/tax are NEVER trusted.
// Checkout re-reads variant prices from D1 and computes everything here.

import type { Market } from './types';

export interface PricedLine {
  unit_price: number; // minor units, from product_variants
  quantity: number;
}

/** Sum of line totals. Returns integer minor units. */
export function calcSubtotal(lines: PricedLine[]): number {
  return lines.reduce((sum, l) => sum + l.unit_price * l.quantity, 0);
}

/** VAT for a market. Tax rate comes from markets.tax_rate (config), never hardcoded. */
export function calcTax(subtotalAfterDiscount: number, market: Pick<Market, 'tax_rate'>): number {
  return Math.round(subtotalAfterDiscount * (market.tax_rate || 0));
}

/** V1 single-method shipping: flat rate, free above threshold (both from market config). */
export function calcShipping(
  subtotalAfterDiscount: number,
  market: Pick<Market, 'flat_shipping_rate' | 'free_shipping_threshold'>,
): number {
  const flat = market.flat_shipping_rate ?? 0;
  const threshold = market.free_shipping_threshold ?? 0;
  if (threshold > 0 && subtotalAfterDiscount >= threshold) return 0;
  return flat;
}

export interface OrderTotals {
  subtotal: number;
  discount: number;
  shipping: number;
  tax: number;
  total: number;
}

/** Full server-side total. V1 has no active promotions — discount stays 0. */
export function calcOrderTotals(
  lines: PricedLine[],
  market: Pick<Market, 'tax_rate' | 'flat_shipping_rate' | 'free_shipping_threshold'>,
  discount = 0,
): OrderTotals {
  const subtotal = calcSubtotal(lines);
  const safeDiscount = Math.min(Math.max(0, discount), subtotal);
  const afterDiscount = subtotal - safeDiscount;
  const shipping = calcShipping(afterDiscount, market);
  const tax = calcTax(afterDiscount, market);
  return {
    subtotal,
    discount: safeDiscount,
    shipping,
    tax,
    total: afterDiscount + shipping + tax,
  };
}
