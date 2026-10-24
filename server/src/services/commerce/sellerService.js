import { randomBytes } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';

const ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';
const listingId = () => `S${[...randomBytes(9)].map((b) => ALPHABET[b % ALPHABET.length]).join('')}`;

/** A seller listing in the shape the catalogue indexes (same fields as a dataset record). */
export const toCatalogRecord = (l) => ({
  parent_asin: l.id, title: l.title, brand: l.brand, price_cents: l.priceCents, category: l.category,
  features: l.features, description: l.description, images: l.images,
  seller_id: l.sellerId, store_name: l.storeName, stock_qty: l.stockQty, listed_at: l.createdAt,
});

const listingView = (l) => ({
  id: l.id, title: l.title, brand: l.brand, category: l.category, priceCents: l.priceCents, stockQty: l.stockQty,
  description: l.description, features: l.features, images: l.images, isActive: l.isActive, createdAt: l.createdAt,
});

/** What a seller may see of an order: their own items and where to send them. Never other sellers' items or totals. */
const sellerOrderView = (order, sellerId) => {
  const items = order.items.filter((i) => i.sellerId === sellerId)
    .map((i) => ({ productId: i.productId, title: i.title, image: i.image, qty: i.qty, unitPriceCents: i.unitPriceCents, fulfilment: i.fulfilment ?? 'pending', shippedAt: i.shippedAt ?? null }));
  return {
    id: order.id, orderNumber: order.orderNumber, createdAt: order.createdAt, shippingAddress: order.shippingAddress,
    payment: { demo: Boolean(order.payment?.demo) }, items,
    subtotalCents: items.reduce((n, i) => n + i.unitPriceCents * i.qty, 0),
    fulfilment: items.every((i) => i.fulfilment === 'shipped') ? 'shipped' : 'pending',
  };
};

/** Seller workspace: listings (kept in step with the live catalogue), orders for their items, and summary figures. */
export function createSellerService({ store, getCatalog, now = () => new Date() }) {
  const categoryOf = (slug) => {
    const category = getCatalog().categories.find((c) => c.slug === slug);
    if (!category) throw new AppError(400, 'Choose one of the listed categories.', 'VALIDATION_ERROR');
    return { slug: category.slug, label: category.label };
  };
  /** Keep the shop in step with the database: active listings are searchable, inactive ones are not. */
  const sync = (listing) => {
    if (listing.isActive) getCatalog().upsert(toCatalogRecord(listing)); else getCatalog().remove(listing.id);
  };

  return {
    /** Refresh the shop after stock changed outside the seller's own edits (a sale). */
    syncListings(listings) {
      for (const l of listings) sync(l);
    },

    /** Load every active listing into the catalogue. Called once at startup. */
    async hydrate() {
      const listings = await store.listActiveListings();
      for (const l of listings) getCatalog().upsert(toCatalogRecord(l));
      return listings.length;
    },

    async create(user, input) {
      const listing = await store.createListing({
        id: listingId(), sellerId: user.id, storeName: user.storeName, title: input.title, brand: input.brand ?? '',
        category: categoryOf(input.category), priceCents: input.priceCents, description: input.description ?? '',
        features: input.features ?? [], images: input.imageUrls.map((url) => ({ thumb: url, large: url })), stockQty: input.stockQty,
      });
      sync(listing);
      return listingView(listing);
    },

    async update(user, id, input) {
      const patch = {};
      for (const key of ['title', 'brand', 'priceCents', 'description', 'features', 'stockQty']) if (key in input) patch[key] = input[key];
      if ('category' in input) patch.category = categoryOf(input.category);
      if ('imageUrls' in input) patch.images = input.imageUrls.map((url) => ({ thumb: url, large: url }));
      if ('isActive' in input) patch.isActive = input.isActive;
      const listing = await store.updateListing(id, user.id, patch);
      if (!listing) throw new AppError(404, 'Product not found.', 'NOT_FOUND'); // also the answer for someone else's product
      sync(listing);
      return listingView(listing);
    },

    async list(user) {
      return (await store.listListingsForSeller(user.id)).map(listingView);
    },

    async orders(user) {
      return (await store.listOrdersForSeller(user.id)).map((o) => sellerOrderView(o, user.id));
    },

    async ship(user, orderId) {
      const order = await store.markSellerItemsShipped(orderId, user.id, now());
      if (!order) throw new AppError(404, 'Order not found.', 'NOT_FOUND');
      return sellerOrderView(order, user.id);
    },

    /** Real counts only. Revenue is the value of this seller's items in paid orders (demo payments included, and labelled so). */
    async summary(user) {
      const [listings, orders] = await Promise.all([store.listListingsForSeller(user.id), store.listOrdersForSeller(user.id)]);
      const mine = orders.map((o) => sellerOrderView(o, user.id));
      return {
        store: { name: user.storeName },
        products: { total: listings.length, active: listings.filter((l) => l.isActive).length, outOfStock: listings.filter((l) => l.stockQty < 1).length },
        orders: { total: mine.length, toShip: mine.filter((o) => o.fulfilment === 'pending').length, shipped: mine.filter((o) => o.fulfilment === 'shipped').length },
        salesCents: mine.reduce((n, o) => n + o.subtotalCents, 0),
        demoOrders: mine.filter((o) => o.payment.demo).length,
      };
    },
  };
}
