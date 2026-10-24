import { AppError } from '../../utils/AppError.js';

export const MAX_WISHLIST_ITEMS = 200;

/** A signed-in user's saved products. Ids only are stored; the shown product data always comes from the catalogue. */
export function createWishlistService({ store, getCatalog }) {
  const view = (ids) => {
    const catalog = getCatalog();
    const items = [];
    for (const id of ids) {
      const hit = catalog.getSummary(id); // ids that left the catalogue are skipped
      if (hit) items.push(hit);
    }
    return { items, ids: items.map((i) => i.id), count: items.length };
  };

  return {
    async get(userId) {
      return view(await store.getWishlistIds(userId));
    },
    /** Adding twice is not an error: the end state is what the user asked for. */
    async add(userId, productId) {
      if (!getCatalog().getById(productId)) throw new AppError(404, 'This product is not available.', 'PRODUCT_NOT_FOUND');
      const ids = await store.getWishlistIds(userId);
      if (!ids.includes(productId)) {
        if (ids.length >= MAX_WISHLIST_ITEMS) throw new AppError(409, `Your wishlist can hold up to ${MAX_WISHLIST_ITEMS} products.`, 'WISHLIST_FULL');
        await store.setWishlistIds(userId, [productId, ...ids]); // newest first
      }
      return view(await store.getWishlistIds(userId));
    },
    async remove(userId, productId) {
      const ids = await store.getWishlistIds(userId);
      await store.setWishlistIds(userId, ids.filter((id) => id !== productId));
      return view(await store.getWishlistIds(userId));
    },
  };
}
