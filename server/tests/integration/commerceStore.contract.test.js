import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createMemoryCommerceStore } from '../../src/services/commerce/memoryStore.js';
import { createMongoCommerceStore } from '../../src/services/commerce/mongoStore.js';
import { Cart, CheckoutSession, Order } from '../../src/models/index.js';

// Same behaviour tests for the in-memory store (always) and real MongoDB (when MONGO_TEST_URL is set, as in CI).
const MONGO_TEST_URL = process.env.MONGO_TEST_URL;
const targets = [
  { name: 'memory store', make: async () => createMemoryCommerceStore(), newUserId: () => `user-${Math.random()}` },
  ...(MONGO_TEST_URL ? [{
    name: 'MongoDB store',
    make: async () => { await Promise.all([Cart.deleteMany({}), CheckoutSession.deleteMany({}), Order.deleteMany({})]); return createMongoCommerceStore(); },
    newUserId: () => String(new mongoose.Types.ObjectId()),
  }] : []),
];

beforeAll(async () => {
  if (MONGO_TEST_URL) {
    await mongoose.connect(MONGO_TEST_URL, { serverSelectionTimeoutMS: 15000 });
    await Promise.all([Cart.init(), CheckoutSession.init(), Order.init()]);
  }
});
afterAll(async () => { if (MONGO_TEST_URL) await mongoose.disconnect(); });

const sessionData = (userId, over = {}) => ({
  userId, provider: 'demo',
  items: [{ productId: 'A4', title: 'Kids Building Blocks', brand: 'Blocko', image: null, unitPriceCents: 1999, qty: 2 }],
  subtotalCents: 3998, shippingCents: 599, totalCents: 4597, currency: 'usd',
  shippingAddress: { name: 'Asha', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' }, ...over,
});
const orderData = (session, number = 'CRT-AAAAAAAA') => ({
  orderNumber: number, userId: session.userId, status: 'paid', items: session.items, subtotalCents: session.subtotalCents,
  shippingCents: session.shippingCents, totalCents: session.totalCents, currency: 'usd', shippingAddress: session.shippingAddress,
  payment: { provider: 'demo', demo: true, sessionId: session.id }, paidAt: new Date(), timeline: [{ status: 'paid', at: new Date() }],
});

describe.each(targets)('commerce store contract: $name', ({ make, newUserId }) => {
  let store; let userId;
  beforeEach(async () => { store = await make(); userId = newUserId(); });

  it('keeps a cart per user as ids and quantities, and empties it', async () => {
    expect(await store.getCartItems(userId)).toEqual([]);
    await store.setCartItems(userId, [{ productId: 'A1', qty: 2 }, { productId: 'A4', qty: 1 }]);
    expect(await store.getCartItems(userId)).toEqual([{ productId: 'A1', qty: 2 }, { productId: 'A4', qty: 1 }]);
    await store.setCartItems(userId, [{ productId: 'A1', qty: 5 }]);
    expect(await store.getCartItems(userId)).toEqual([{ productId: 'A1', qty: 5 }]);
    await store.setCartItems(userId, []);
    expect(await store.getCartItems(userId)).toEqual([]);
    expect(await store.getCartItems(newUserId())).toEqual([]);
  });

  it('creates and finds a pending session', async () => {
    const session = await store.createSession(sessionData(userId));
    expect(session).toMatchObject({ userId, status: 'pending', provider: 'demo', totalCents: 4597 });
    expect(await store.findSession(session.id)).toMatchObject({ id: session.id, status: 'pending' });
    expect(await store.findSession('does-not-exist')).toBeNull();
  });

  it('moves a session between states only from the expected state', async () => {
    const { id } = await store.createSession(sessionData(userId));
    expect(await store.transitionSession(id, 'pending', { status: 'failed', failureReason: 'declined' })).toMatchObject({ status: 'failed', failureReason: 'declined' });
    expect(await store.transitionSession(id, 'pending', { status: 'succeeded' })).toBeNull(); // already failed
    expect((await store.findSession(id)).status).toBe('failed');
  });

  it('creates one order per payment session, even when asked twice', async () => {
    const session = await store.createSession(sessionData(userId));
    const first = await store.createOrderForSession(orderData(session, 'CRT-AAAAAAAA'));
    const second = await store.createOrderForSession(orderData(session, 'CRT-BBBBBBBB'));
    expect(first.created).toBe(true);
    expect(second.created).toBe(false);
    expect(second.order.id).toBe(first.order.id);
    expect(second.order.orderNumber).toBe('CRT-AAAAAAAA');
    expect(await store.listOrdersForUser(userId)).toHaveLength(1);
    expect(first.order.payment).toEqual({ provider: 'demo', demo: true, sessionId: session.id });
  });

  it('finds orders by id and lists only the buyer\'s own, newest first', async () => {
    const s1 = await store.createSession(sessionData(userId));
    const s2 = await store.createSession(sessionData(userId));
    const other = await store.createSession(sessionData(newUserId()));
    const a = await store.createOrderForSession(orderData(s1, 'CRT-AAAAAAA1'));
    await new Promise((r) => setTimeout(r, 5));
    const b = await store.createOrderForSession(orderData(s2, 'CRT-AAAAAAA2'));
    await store.createOrderForSession(orderData(other, 'CRT-AAAAAAA3'));
    expect((await store.listOrdersForUser(userId)).map((o) => o.id)).toEqual([b.order.id, a.order.id]);
    expect(await store.findOrder(a.order.id)).toMatchObject({ orderNumber: 'CRT-AAAAAAA1', userId });
    expect(await store.findOrder('nope')).toBeNull();
  });
});
