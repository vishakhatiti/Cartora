import { createCartService } from './cartService.js';
import { createWishlistService } from './wishlistService.js';
import { createAddressService } from './addressService.js';
import { createSupportService } from './supportService.js';
import { createSellerService } from './sellerService.js';
import { createNotificationService } from './notificationService.js';
import { createOrderEvents } from './orderEvents.js';
import { createCheckoutService } from './checkoutService.js';

/** Wire the commerce services together. `store` is mongoStore or memoryStore; `provider` comes from payments/. */
export function createCommerce({ store, getCatalog, provider, mailer = null, appUrl = '', log = console }) {
  const carts = createCartService({ store, getCatalog });
  const notifications = createNotificationService({ store, log });
  const events = createOrderEvents({ notifications, mailer, appUrl, log });
  const seller = createSellerService({ store, getCatalog, onShipped: (order, info) => events.shipped(order, info) });
  const checkout = createCheckoutService({ store, carts, provider, getCatalog, onStockChanged: (listings) => seller.syncListings(listings), onOrderPaid: (order, info) => events.orderPaid(order, info) });
  const wishlist = createWishlistService({ store, getCatalog });
  const addresses = createAddressService({ store });
  const support = createSupportService({ store });
  return { store, carts, checkout, wishlist, addresses, support, seller, notifications, provider };
}
