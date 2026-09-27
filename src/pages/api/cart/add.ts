import type { APIRoute } from 'astro';
import { getCommerce } from '../../../lib/commerce';

export const POST: APIRoute = async ({ request, cookies, locals, params, redirect }) => {
  const db = locals.runtime.env.DB;
  const commerce = getCommerce(db);
  
  const formData = await request.formData();
  const productId = formData.get('productId') as string;
  const variantId = formData.get('variantId') as string;
  const quantity = parseInt(formData.get('quantity') as string || '1');

  if (!productId || !variantId) {
    return new Response("Missing product or variant", { status: 400 });
  }

  let sessionId = cookies.get('session_id')?.value;
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    cookies.set('session_id', sessionId, { path: '/' });
  }

  // Get or create cart
  let cartRow = await db.prepare(`SELECT id FROM carts WHERE session_id = ?`).bind(sessionId).first<{id: string}>();
  if (!cartRow) {
    const cart = await commerce.cart.createCart(sessionId);
    cartRow = { id: cart.id };
  }

  await commerce.cart.addItem(cartRow.id, productId, variantId, quantity);

  const lang = formData.get('lang') || 'en';
  return redirect(`/${lang}/cart`);
};
