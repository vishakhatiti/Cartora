import { createCartService } from './cartService.js';
import { createWishlistService } from './wishlistService.js';
import { createAddressService } from './addressService.js';
import { createSupportService } from './supportService.js';
import { createCheckoutService } from './checkoutService.js';

/** Wire the commerce services together. `store` is mongoStore or memoryStore; `provider` comes from payments/. */
export function createCommerce({ store, getCatalog, provider }) {
  const carts = createCartService({ store, getCatalog });
  const checkout = createCheckoutService({ store, carts, provider, getCatalog });
  const wishlist = createWishlistService({ store, getCatalog });
  const addresses = createAddressService({ store });
  const support = createSupportService({ store });
  return { store, carts, checkout, wishlist, addresses, support, provider };
}
