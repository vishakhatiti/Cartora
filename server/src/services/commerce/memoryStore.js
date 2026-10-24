import { randomUUID } from 'node:crypto';

/**
 * In-memory commerce store with the same behaviour as mongoStore.js (see the shared contract tests).
 * Used by tests and for running the API without a database.
 */
export function createMemoryCommerceStore() {
  const carts = new Map(); // userId -> [{ productId, qty }]
  const wishlists = new Map(); // userId -> [productId]
  const addressBooks = new Map(); // userId -> [address]
  const tickets = [];
  const listings = new Map();
  let seq = 0; // breaks ties between records created in the same millisecond, newest first
  const newestFirst = (a, b) => (b.createdAt - a.createdAt) || (b.seq - a.seq);
  const publicCopy = ({ seq: _seq, ...rest }) => clone(rest);
  const sessions = new Map();
  const orders = new Map();
  const orderIdBySession = new Map();
  const clone = (value) => (value == null ? value : structuredClone(value));

  return {
    async getCartItems(userId) {
      return clone(carts.get(userId) ?? []);
    },
    async setCartItems(userId, items) {
      if (items.length === 0) carts.delete(userId); else carts.set(userId, clone(items));
      return clone(items);
    },

    async getWishlistIds(userId) {
      return [...(wishlists.get(userId) ?? [])];
    },
    async setWishlistIds(userId, ids) {
      if (ids.length === 0) wishlists.delete(userId); else wishlists.set(userId, [...ids]);
      return [...ids];
    },

    async getAddresses(userId) {
      return clone(addressBooks.get(userId) ?? []);
    },
    async setAddresses(userId, addresses) {
      if (addresses.length === 0) addressBooks.delete(userId); else addressBooks.set(userId, clone(addresses));
      return clone(addresses);
    },

    async createTicket(data) {
      const ticket = { ...clone(data), id: randomUUID(), status: 'open', createdAt: new Date(), seq: (seq += 1) };
      tickets.push(ticket);
      return publicCopy(ticket);
    },
    async listTicketsForUser(userId) {
      return tickets.filter((t) => t.userId === userId).sort(newestFirst).map(publicCopy);
    },

    // ---- seller listings
    async createListing(data) {
      const listing = { ...clone(data), isActive: true, createdAt: new Date(), updatedAt: new Date(), seq: (seq += 1) };
      listings.set(listing.id, listing);
      return publicCopy(listing);
    },
    async updateListing(id, sellerId, patch) {
      const listing = listings.get(id);
      if (!listing || listing.sellerId !== sellerId) return null;
      Object.assign(listing, clone(patch), { updatedAt: new Date() });
      return publicCopy(listing);
    },
    async findListing(id) {
      return listings.has(id) ? publicCopy(listings.get(id)) : null;
    },
    async listListingsForSeller(sellerId) {
      return [...listings.values()].filter((l) => l.sellerId === sellerId).sort(newestFirst).map(publicCopy);
    },
    async listActiveListings() {
      return [...listings.values()].filter((l) => l.isActive).map(publicCopy);
    },
    /** Returns the listings whose stock changed, so the shop can be updated to match. */
    async consumeStock(items) {
      const changed = new Map();
      for (const item of items) {
        const listing = item.sellerId ? listings.get(item.productId) : null;
        if (listing && listing.sellerId === item.sellerId) {
          listing.stockQty = Math.max(0, listing.stockQty - item.qty);
          changed.set(listing.id, publicCopy(listing));
        }
      }
      return [...changed.values()];
    },

    async listOrdersForSeller(sellerId) {
      return [...orders.values()].filter((o) => o.items.some((i) => i.sellerId === sellerId)).sort(newestFirst).map(publicCopy);
    },
    async markSellerItemsShipped(orderId, sellerId, at) {
      const order = orders.get(orderId);
      if (!order || !order.items.some((i) => i.sellerId === sellerId)) return null;
      for (const item of order.items) if (item.sellerId === sellerId && item.fulfilment !== 'shipped') { item.fulfilment = 'shipped'; item.shippedAt = at; }
      if (order.items.every((i) => i.fulfilment === 'shipped') && order.status === 'paid') { order.status = 'shipped'; order.timeline.push({ status: 'shipped', at }); }
      return clone(order);
    },

    async createSession(data) {
      const session = { ...clone(data), id: randomUUID(), status: 'pending', failureReason: null, orderId: null, createdAt: new Date() };
      sessions.set(session.id, session);
      return clone(session);
    },
    async findSession(id) {
      return clone(sessions.get(id) ?? null);
    },
    /** Change status only if it is currently `from`. Returns the updated session, or null when it was not. */
    async transitionSession(id, from, patch) {
      const session = sessions.get(id);
      if (!session || session.status !== from) return null;
      Object.assign(session, clone(patch));
      return clone(session);
    },
    async attachOrderToSession(id, orderId) {
      const session = sessions.get(id);
      if (session) session.orderId = orderId;
    },

    /** Insert the order for a payment session. A second call for the same session returns the first order. */
    async createOrderForSession(data) {
      const existingId = orderIdBySession.get(data.payment.sessionId);
      if (existingId) return { order: publicCopy(orders.get(existingId)), created: false };
      const order = { ...clone(data), items: data.items.map((i) => ({ fulfilment: 'pending', ...clone(i) })), id: randomUUID(), createdAt: new Date(), seq: (seq += 1) };
      orders.set(order.id, order);
      orderIdBySession.set(order.payment.sessionId, order.id);
      return { order: publicCopy(order), created: true };
    },
    async findOrder(id) {
      return orders.has(id) ? publicCopy(orders.get(id)) : null;
    },
    async listOrdersForUser(userId) {
      return [...orders.values()].filter((o) => o.userId === userId).sort(newestFirst).map(publicCopy);
    },
  };
}
