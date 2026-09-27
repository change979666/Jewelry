// GET /api/cart — current anonymous session cart
import type { Env } from "../../types";
import { getCommerce } from "../../../src/lib/commerce";
import { getSessionId, json, requireDb } from "./_shared";

export const onRequestGet: PagesFunction<Env> = async ({ request, env }) => {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  const sessionId = getSessionId(request);
  if (!sessionId) return json({ ok: true, items: [], subtotal: 0, count: 0 });

  const commerce = getCommerce(db);
  const { items } = await commerce.cart.getCartBySessionId(sessionId);
  const subtotal = items.reduce((sum, i) => sum + i.variant.price * i.quantity, 0);
  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return json({ ok: true, items, subtotal, count, currency: items[0]?.variant.currency ?? 'SAR' });
};
