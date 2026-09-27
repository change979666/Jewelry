// POST /api/cart/remove — body: { item_id }
import { getCommerce } from "@/lib/commerce";
import { getSessionId, json, requireDb } from "@/pages/api/cart/_shared";
import { endpoint, type PagesCtx } from "@/pages/api/_lib/ctx";

async function handlerPost({ request, env }: PagesCtx): Promise<Response> {
  const db = requireDb(env);
  if (!db) return json({ ok: false, error: "Database unavailable" }, 500);

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "Invalid JSON" }, 400);
  }

  const itemId = String(body.item_id || "").trim();
  if (!itemId) return json({ ok: false, error: "item_id is required" }, 422);

  const sessionId = getSessionId(request);
  const row = await db
    .prepare(
      `SELECT ci.id FROM cart_items ci JOIN carts c ON c.id = ci.cart_id WHERE ci.id = ? AND c.session_id = ?`,
    )
    .bind(itemId, sessionId ?? "")
    .first();
  if (!row) return json({ ok: false, error: "Not found" }, 404);

  await getCommerce(db).cart.removeItem(itemId);
  return json({ ok: true });
}

// ---- Astro endpoint exports (migrated from Pages Functions) ----
export const POST = endpoint(handlerPost);
