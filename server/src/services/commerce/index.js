import { createCartService } from './cartService.js';
import { createCheckoutService } from './checkoutService.js';

/** Wire the commerce services together. `store` is mongoStore or memoryStore; `provider` comes from payments/. */
export function createCommerce({ store, getCatalog, provider }) {
  const carts = createCartService({ store, getCatalog });
  const checkout = createCheckoutService({ store, carts, provider, getCatalog });
  return { store, carts, checkout, provider };
}
