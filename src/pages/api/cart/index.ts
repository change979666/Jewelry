// GET /api/cart — current anonymous session cart
import { getCommerce } from "@/lib/commerce";
import { getSessionId, json, requireDb } from "@/pages/api/cart/_shared";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

async function handlerGet({ request, env }: PagesCtx): Promise<Response> {
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

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const GET = endpoint(handlerGet);
