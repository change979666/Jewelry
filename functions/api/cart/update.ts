// POST /api/cart/update — body: { item_id, quantity }
import type { Env } from "../../types";
import { getCommerce } from "../../../src/lib/commerce";
import { getSessionId, json, requireDb } from "./_shared";

export const onRequestPost: PagesFunction<Env> = async ({ request, env }) => {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const itemId = String(body.item_id || "").trim();
  const quantity = Math.floor(Number(body.quantity) || 0);
  if (!itemId) return json({ ok: false, error: "item_id is required" }, 422);

  // Ownership check: the item must belong to the caller's session cart
  const sessionId = getSessionId(request);
  const row = await db
    .prepare(`SELECT ci.id FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE ci.id = ? AND c.session_id = ?`)
    .bind(itemId, sessionId ?? "")
    .first();
  if (!row) return json({ ok: false, error: "Not found" }, 404);

  await getCommerce(db).cart.updateItemQuantity(itemId, quantity);
  return json({ ok: true });
};
