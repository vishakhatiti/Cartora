import { randomBytes } from 'node:crypto';
import { AppError } from '../../utils/AppError.js';
import { priceItems } from './pricing.js';

const ORDER_NUMBER_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789'; // no look-alike characters
const orderNumber = () => `CRT-${[...randomBytes(8)].map((b) => ORDER_NUMBER_ALPHABET[b % ORDER_NUMBER_ALPHABET.length]).join('')}`;

const sessionView = (s, provider) => ({
  id: s.id, status: s.status, items: s.items, subtotalCents: s.subtotalCents, shippingCents: s.shippingCents,
  totalCents: s.totalCents, currency: s.currency, shippingAddress: s.shippingAddress, failureReason: s.failureReason,
  orderId: s.orderId, payment: { provider: s.provider, demo: s.provider === 'demo', label: provider.label ?? null },
});

/** Public order shape. `payment.demo` is true only for simulated payments; nothing here ever says "stripe" for a demo. */
export const orderView = (o) => ({
  id: o.id, orderNumber: o.orderNumber, status: o.status,
  // The seller's account id is internal; the store name and shipping state are shown to the buyer.
  items: o.items.map(({ sellerId, ...item }) => item),
  subtotalCents: o.subtotalCents,
  shippingCents: o.shippingCents, totalCents: o.totalCents, currency: o.currency, shippingAddress: o.shippingAddress,
  payment: { provider: o.payment.provider, demo: o.payment.demo }, paidAt: o.paidAt, createdAt: o.createdAt,
});

/**
 * Checkout: price the account cart on the server, open a payment session, and turn a successful payment into an order.
 * completeSession() is the single place that creates orders. The demo "simulate" route calls it today and the
 * verified Stripe webhook will call it later, so the rules (idempotency, cart handling) do not change.
 */
export function createCheckoutService({ store, carts, provider, getCatalog, onStockChanged = () => {}, onOrderPaid = async () => {}, now = () => new Date() }) {
  const ownSession = async (userId, id) => {
    const session = await store.findSession(id);
    if (!session || session.userId !== userId) throw new AppError(404, 'Checkout not found.', 'NOT_FOUND');
    return session;
  };

  return {
    provider,

    async startCheckout(user, address) {
      const items = await store.getCartItems(user.id);
      if (items.length === 0) throw new AppError(400, 'Your cart is empty.', 'CART_EMPTY');
      const priced = priceItems(getCatalog(), items);
      if (priced.issues.length > 0 || priced.lines.length === 0) {
        throw new AppError(409, 'Some items in your cart are no longer available. Review your cart and try again.', 'CART_INVALID');
      }
      const session = await store.createSession({
        userId: user.id,
        buyerEmail: user.email,
        provider: provider.name,
        items: priced.lines.map(({ productId, title, brand, image, unitPriceCents, qty, sellerId, storeName }) => ({ productId, title, brand, image, unitPriceCents, qty, sellerId, storeName })),
        ...priced.totals,
        currency: priced.currency,
        shippingAddress: address,
      });
      const { redirect } = await provider.startCheckout(session);
      return { session: sessionView(session, provider), redirect };
    },

    async getSession(user, id) {
      return sessionView(await ownSession(user.id, id), provider);
    },

    /** Called by the demo simulate route, and later by the Stripe webhook. Safe to call more than once. */
    async completeSession(sessionId, { outcome, reason }) {
      const session = await store.findSession(sessionId);
      if (!session) throw new AppError(404, 'Checkout not found.', 'NOT_FOUND');

      if (outcome === 'failed') {
        if (session.status === 'succeeded') throw new AppError(409, 'This payment already succeeded.', 'ALREADY_PAID');
        if (session.status === 'pending') {
          await store.transitionSession(sessionId, 'pending', { status: 'failed', failureReason: reason ?? 'Payment was declined.' });
        }
        return { session: sessionView(await store.findSession(sessionId), provider), order: null };
      }

      if (outcome !== 'succeeded') throw new AppError(400, 'Unknown payment outcome.', 'VALIDATION_ERROR');
      if (session.status === 'failed') throw new AppError(409, 'This payment attempt already failed. Start a new checkout.', 'SESSION_FAILED');
      // Take the stock first, all or nothing. If someone else bought the last unit while this buyer was paying,
      // nothing is sold: the session fails with a clear reason and no order exists. (With a real payment provider this
      // is the point where a refund would be issued; the demo provider moves no money.)
      let stockTaken = null;
      if (session.status === 'pending') {
        stockTaken = await store.takeStock(session.items);
        if (!stockTaken.ok) {
          await store.transitionSession(sessionId, 'pending', { status: 'failed', failureReason: 'An item sold out while you were paying. You were not charged.' });
          return { session: sessionView(await store.findSession(sessionId), provider), order: null };
        }
        onStockChanged(stockTaken.changed);
      }
      // Claim the session. If this runs twice, or crashes half way, running it again finishes the job.
      if (session.status === 'pending') {
        const claimed = await store.transitionSession(sessionId, 'pending', { status: 'succeeded' });
        if (!claimed && (await store.findSession(sessionId)).status === 'failed') {
          throw new AppError(409, 'This payment attempt already failed. Start a new checkout.', 'SESSION_FAILED');
        }
      }
      const paidAt = now();
      const { order, created } = await store.createOrderForSession({
        orderNumber: orderNumber(),
        userId: session.userId,
        status: 'paid',
        items: session.items.map((i) => ({ ...i, fulfilment: 'pending' })),
        subtotalCents: session.subtotalCents,
        shippingCents: session.shippingCents,
        totalCents: session.totalCents,
        currency: session.currency,
        shippingAddress: session.shippingAddress,
        payment: { provider: session.provider, demo: session.provider === 'demo', sessionId: session.id },
        paidAt,
        timeline: [{ status: 'paid', at: paidAt }],
      });
      if (created) {
        await store.attachOrderToSession(sessionId, order.id);
        await carts.removePurchased(session.userId, session.items);
        await onOrderPaid(orderView(order), { userId: session.userId, email: session.buyerEmail, sellerIds: [...new Set(session.items.map((i) => i.sellerId).filter(Boolean))] });
      }
      return { session: sessionView(await store.findSession(sessionId), provider), order: orderView(order) };
    },

    async getOrder(user, id) {
      const order = await store.findOrder(id);
      if (!order || order.userId !== user.id) throw new AppError(404, 'Order not found.', 'NOT_FOUND');
      return orderView(order);
    },

    async listOrders(user) {
      return (await store.listOrdersForUser(user.id)).map(orderView);
    },
  };
}
