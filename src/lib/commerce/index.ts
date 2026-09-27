import type { D1Database } from '@cloudflare/workers-types';
import { ProductService } from './product.service';
import { CartService } from './cart.service';
import { OrderService } from './order.service';
import { CODProvider } from './providers/payment';

export class CommerceCore {
  public products: ProductService;
  public cart: CartService;
  public orders: OrderService;
  public codProvider: CODProvider;

  constructor(db: D1Database) {
    this.products = new ProductService(db);
    this.cart = new CartService(db);
    this.orders = new OrderService(db);
    this.codProvider = new CODProvider(db);
  }
}

export function getCommerce(db: D1Database): CommerceCore {
  return new CommerceCore(db);
}
