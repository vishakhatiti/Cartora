import { randomUUID } from 'node:crypto';

/**
 * In-memory commerce store with the same behaviour as mongoStore.js (see the shared contract tests).
 * Used by tests and for running the API without a database.
 */
export function createMemoryCommerceStore() {
  const carts = new Map(); // userId -> [{ productId, qty }]
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
      if (existingId) return { order: clone(orders.get(existingId)), created: false };
      const order = { ...clone(data), id: randomUUID(), createdAt: new Date() };
      orders.set(order.id, order);
      orderIdBySession.set(order.payment.sessionId, order.id);
      return { order: clone(order), created: true };
    },
    async findOrder(id) {
      return clone(orders.get(id) ?? null);
    },
    async listOrdersForUser(userId) {
      return [...orders.values()].filter((o) => o.userId === userId).sort((a, b) => b.createdAt - a.createdAt).map(clone);
    },
  };
}
