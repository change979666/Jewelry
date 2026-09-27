// POST /api/cart/clear — empty the caller's session cart
import type { Env } from "../../types";
import { getCommerce } from "../../../src/lib/commerce";
import { getSessionId, json, requireDb } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  const sessionId = getSessionId(request);
  if (!sessionId) return json({ ok: true });

  const { cart } = await getCommerce(db).cart.getCartBySessionId(sessionId);
  await getCommerce(db).cart.clearCart(cart.id);
  return json({ ok: true });
};
