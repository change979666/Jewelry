// POST /api/cart/add — body: { product_id, variant_id, quantity }
import type { Env } from "../../types";
import { getCommerce } from "../../../src/lib/commerce";
import { SESSION_COOKIE, getSessionId, json, requireDb } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const productId = String(body.product_id || "").trim();
  const variantId = String(body.variant_id || "").trim();
  const quantity = Math.floor(Number(body.quantity) || 1);

  if (!productId || !variantId) return json({ ok: false, error: "product_id and variant_id are required" }, 422);
  if (quantity < 1 || quantity > 999) return json({ ok: false, error: "Invalid quantity" }, 422);

  let sessionId = getSessionId(request);
  const isNewSession = !sessionId;
  if (!sessionId) sessionId = crypto.randomUUID();

  const commerce = getCommerce(db);
  const { cart } = await commerce.cart.getCartBySessionId(sessionId);
  const result = await commerce.cart.addItem(cart.id, productId, variantId, quantity);
  if (!result.ok) {
    const status = result.error === 'variant_not_found' ? 404 : 422;
    return json({ ok: false, error: result.error }, status);
  }

  const headers: Record<string, string> = {};
  if (isNewSession) {
    headers["Set-Cookie"] = `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
  }
  return json({ ok: true, cart_id: cart.id }, 200, headers);
};
