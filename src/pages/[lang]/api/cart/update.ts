import type { APIRoute } from 'astro';
import { getCommerce } from '../../../../../lib/commerce';

export const POST: APIRoute = async ({ request, locals, params, redirect }) => {
  const db = locals.runtime.env.DB;
  const commerce = getCommerce(db);
  const formData = await request.formData();
  
  const itemId = formData.get('itemId') as string;
  const quantity = parseInt(formData.get('quantity') as string || '0');

  if (itemId) {
    await commerce.cart.updateItemQuantity(itemId, quantity);
  }

  return redirect(`/${params.lang}/cart`);
};
