import { AppError } from '../../utils/AppError.js';
import { MAX_QTY_PER_ITEM } from '../../utils/money.js';
import { MAX_CART_LINES, normalizeItems, priceItems } from './pricing.js';

/** Cart rules. Signed-in carts live in the store as ids and quantities; prices are always read from the catalogue. */
export function createCartService({ store, getCatalog }) {
  const view = (items) => priceItems(getCatalog(), items);

  return {
    /** Price any list of items without saving it. Used for guest carts, which live in the browser. */
    quote(items) {
      return view(items);
    },

    async get(userId) {
      return view(await store.getCartItems(userId));
    },

    async setQuantity(userId, productId, qty) {
      const product = getCatalog().getById(productId);
      if (!product) throw new AppError(404, 'This product is not available.', 'PRODUCT_NOT_FOUND');
      if (product.stockQty != null && qty > product.stockQty) {
        throw new AppError(409, product.stockQty < 1 ? 'This product is out of stock.' : `Only ${product.stockQty} available.`, 'INSUFFICIENT_STOCK');
      }
      const items = await store.getCartItems(userId);
      const next = items.filter((i) => i.productId !== productId);
      if (next.length >= MAX_CART_LINES && !items.some((i) => i.productId === productId)) {
        throw new AppError(409, `Your cart can hold up to ${MAX_CART_LINES} different products.`, 'CART_FULL');
      }
      next.push({ productId, qty });
      await store.setCartItems(userId, normalizeItems(next));
      return this.get(userId);
    },

    async remove(userId, productId) {
      const items = await store.getCartItems(userId);
      await store.setCartItems(userId, items.filter((i) => i.productId !== productId));
      return this.get(userId);
    },

    async clear(userId) {
      await store.setCartItems(userId, []);
      return this.get(userId);
    },

    /**
     * Fold a guest's browser cart into the account cart. Nothing is dropped silently: every item that could
     * not be merged is returned in `skipped` with a reason, and the caller keeps the guest cart until this succeeds.
     */
    async merge(userId, guestItems) {
      const catalog = getCatalog();
      const current = new Map((await store.getCartItems(userId)).map((i) => [i.productId, i.qty]));
      const skipped = [];
      let merged = 0;
      for (const { productId, qty } of normalizeItems(guestItems)) {
        if (!catalog.getById(productId)) { skipped.push({ productId, reason: 'UNAVAILABLE' }); continue; }
        if (!current.has(productId) && current.size >= MAX_CART_LINES) { skipped.push({ productId, reason: 'CART_FULL' }); continue; }
        const total = (current.get(productId) ?? 0) + qty;
        if (total > MAX_QTY_PER_ITEM) skipped.push({ productId, reason: 'QUANTITY_LIMITED' });
        current.set(productId, Math.min(MAX_QTY_PER_ITEM, total));
        merged += 1;
      }
      await store.setCartItems(userId, [...current].map(([productId, qty]) => ({ productId, qty })));
      return { cart: await this.get(userId), merged, skipped };
    },

    /** After an order: take the purchased quantities out of the cart, keeping anything added since. */
    async removePurchased(userId, purchased) {
      const bought = new Map(purchased.map((p) => [p.productId, p.qty]));
      const remaining = (await store.getCartItems(userId))
        .map((i) => ({ productId: i.productId, qty: i.qty - (bought.get(i.productId) ?? 0) }))
        .filter((i) => i.qty > 0);
      await store.setCartItems(userId, remaining);
    },
  };
}
