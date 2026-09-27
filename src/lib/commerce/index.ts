import type { D1Database } from '@cloudflare/workers-types';
import { ProductService } from './product.service';
import { CollectionService } from './collection.service';
import { CartService } from './cart.service';
import { OrderService } from './order.service';
import { CustomerService } from './customer.service';
import { CODProvider, HostedCheckoutProvider } from './providers/payment';

export class CommerceCore {
  public products: ProductService;
  public collections: CollectionService;
  public cart: CartService;
  public orders: OrderService;
  public customers: CustomerService;
  public cod: CODProvider;
  public hosted: HostedCheckoutProvider;

  constructor(db: D1Database, options: { enableOnlinePayment?: boolean } = {}) {
    this.products = new ProductService(db);
    this.collections = new CollectionService(db);
    this.cart = new CartService(db);
    this.orders = new OrderService(db);
    this.customers = new CustomerService(db);
    this.cod = new CODProvider(db);
    this.hosted = new HostedCheckoutProvider(db, { enabled: options.enableOnlinePayment === true });
  }
}

export function getCommerce(db: D1Database, options?: { enableOnlinePayment?: boolean }): CommerceCore {
  return new CommerceCore(db, options);
}

export * from './types';
export * from './pricing';
export * from './order.service';
