// POST /api/cart/clear — empty the caller's session cart
import { getCommerce } from "@/lib/commerce";
import { getSessionId, json, requireDb } from "@/pages/api/cart/_shared";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

async function handlerPost({ request, env }: PagesCtx): Promise<Response> {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  const sessionId = getSessionId(request);
  if (!sessionId) return json({ ok: true });

  const { cart } = await getCommerce(db).cart.getCartBySessionId(sessionId);
  await getCommerce(db).cart.clearCart(cart.id);
  return json({ ok: true });
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const POST = endpoint(handlerPost);
