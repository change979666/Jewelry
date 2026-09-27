import type { APIRoute } from 'astro';
import { getCommerce } from '../../../../../lib/commerce';

export const POST: APIRoute = async ({ request, locals, params, redirect }) => {
  const db = locals.runtime.env.DB;
  const commerce = getCommerce(db);
  const formData = await request.formData();
  
  const itemId = formData.get('itemId') as string;

  if (itemId) {
    await commerce.cart.removeItem(itemId);
  }

  return redirect(`/${params.lang}/cart`);
};
