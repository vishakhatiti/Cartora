import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createMemoryCommerceStore } from '../../src/services/commerce/memoryStore.js';
import { createMongoCommerceStore } from '../../src/services/commerce/mongoStore.js';
import { Cart, CheckoutSession, Order, Product, Notification, Wishlist, AddressBook, SupportTicket } from '../../src/models/index.js';

// Same behaviour tests for the in-memory store (always) and real MongoDB (when MONGO_TEST_URL is set, as in CI).
const MONGO_TEST_URL = process.env.MONGO_TEST_URL;
const targets = [
  { name: 'memory store', make: async () => createMemoryCommerceStore(), newUserId: () => `user-${Math.random()}` },
  ...(MONGO_TEST_URL ? [{
    name: 'MongoDB store',
    make: async () => { await Promise.all([Cart.deleteMany({}), CheckoutSession.deleteMany({}), Order.deleteMany({}), Wishlist.deleteMany({}), AddressBook.deleteMany({}), SupportTicket.deleteMany({}), Product.deleteMany({}), Notification.deleteMany({})]); return createMongoCommerceStore(); },
    newUserId: () => String(new mongoose.Types.ObjectId()),
  }] : []),
];

beforeAll(async () => {
  if (MONGO_TEST_URL) {
    await mongoose.connect(MONGO_TEST_URL, { serverSelectionTimeoutMS: 15000 });
    await Promise.all([Cart.init(), CheckoutSession.init(), Order.init(), Wishlist.init(), AddressBook.init(), SupportTicket.init(), Product.init(), Notification.init()]);
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

  const listingData = (sellerId, id = 'SAAAAAAAAA', over = {}) => ({
    id, sellerId, storeName: 'Asha Crafts', title: 'Mug', brand: 'Asha', category: { slug: 'crafts', label: 'Crafts' }, priceCents: 2450,
    description: 'A mug.', features: ['Dishwasher safe'], images: [{ thumb: 'https://i.example.com/a.jpg', large: 'https://i.example.com/a.jpg' }], stockQty: 5, ...over,
  });

  it('stores notifications per user, newest first, and marks them read', async () => {
    await store.createNotification({ userId, type: 'order_paid', title: 'Order confirmed', message: 'Order CRT-AAAAAAAA is confirmed.', link: '/orders/1' });
    await store.createNotification({ userId, type: 'order_status', title: 'Items shipped', message: 'Shipped.', link: '/orders/1' });
    await store.createNotification({ userId: newUserId(), type: 'new_order', title: 'Other', message: 'Not yours.', link: '/sell/orders' });
    expect((await store.listNotifications(userId)).map((n) => n.title)).toEqual(['Items shipped', 'Order confirmed']);
    expect(await store.countUnreadNotifications(userId)).toBe(2);
    await store.markNotificationsRead(userId);
    expect(await store.countUnreadNotifications(userId)).toBe(0);
    expect((await store.listNotifications(userId)).every((n) => n.readAt)).toBe(true);
  });

  it('stores seller listings, lets only the owner change them and lists active ones', async () => {
    const created = await store.createListing(listingData(userId));
    expect(created).toMatchObject({ id: 'SAAAAAAAAA', sellerId: userId, title: 'Mug', priceCents: 2450, stockQty: 5, isActive: true, category: { slug: 'crafts', label: 'Crafts' } });
    expect(await store.findListing('SAAAAAAAAA')).toMatchObject({ id: 'SAAAAAAAAA' });
    expect(await store.findListing('NOPE')).toBeNull();
    expect(await store.updateListing('SAAAAAAAAA', newUserId(), { priceCents: 1 })).toBeNull(); // not the owner
    const edited = await store.updateListing('SAAAAAAAAA', userId, { priceCents: 3000, stockQty: 2, title: 'Mug v2', isActive: true });
    expect(edited).toMatchObject({ priceCents: 3000, stockQty: 2, title: 'Mug v2' });
    await store.createListing(listingData(userId, 'SBBBBBBBBB'));
    await store.updateListing('SBBBBBBBBB', userId, { isActive: false });
    expect((await store.listActiveListings()).map((l) => l.id)).toEqual(['SAAAAAAAAA']);
    expect((await store.listListingsForSeller(userId)).map((l) => l.id).sort()).toEqual(['SAAAAAAAAA', 'SBBBBBBBBB']);
    expect(await store.listListingsForSeller(newUserId())).toEqual([]);
  });

  it('takes stock for sold listing items, never below zero, and ignores marketplace items', async () => {
    await store.createListing(listingData(userId, 'SCCCCCCCCC', { stockQty: 3 }));
    const changed = await store.consumeStock([{ productId: 'SCCCCCCCCC', sellerId: userId, qty: 2 }, { productId: 'A4', sellerId: null, qty: 5 }]);
    expect(changed.map((l) => [l.id, l.stockQty])).toEqual([['SCCCCCCCCC', 1]]);
    const again = await store.consumeStock([{ productId: 'SCCCCCCCCC', sellerId: userId, qty: 5 }]);
    expect(again[0].stockQty).toBe(0);
  });

  it('finds orders by seller and marks only that seller\'s items shipped', async () => {
    const other = newUserId();
    const buyer = newUserId();
    const session = await store.createSession(sessionData(buyer, { items: [
      { productId: 'SAAAAAAAAA', title: 'Mug', brand: 'Asha', image: null, unitPriceCents: 2450, qty: 1, sellerId: userId, storeName: 'Asha Crafts' },
      { productId: 'SDDDDDDDDD', title: 'Bowl', brand: 'Other', image: null, unitPriceCents: 1000, qty: 1, sellerId: other, storeName: 'Other' },
    ] }));
    const { order } = await store.createOrderForSession(orderData(session, 'CRT-SELLER01'));
    expect((await store.listOrdersForSeller(userId)).map((o) => o.id)).toEqual([order.id]);
    expect(await store.listOrdersForSeller(newUserId())).toEqual([]);
    expect(await store.markSellerItemsShipped(order.id, newUserId(), new Date())).toBeNull();
    const half = await store.markSellerItemsShipped(order.id, userId, new Date());
    expect(half.items.map((i) => [i.productId, i.fulfilment])).toEqual([['SAAAAAAAAA', 'shipped'], ['SDDDDDDDDD', 'pending']]);
    expect(half.status).toBe('paid');
    const all = await store.markSellerItemsShipped(order.id, other, new Date());
    expect(all.status).toBe('shipped');
    expect(all.timeline.map((t) => t.status)).toEqual(['paid', 'shipped']);
  });

  it('stores support tickets and lists a user\'s own, newest first', async () => {
    const base = { name: 'Asha', email: 'asha@example.com', topic: 'order', orderNumber: null, message: 'Where is my parcel please?' };
    const one = await store.createTicket({ ...base, userId, ticketNumber: 'SUP-AAAAAAAA' });
    expect(one).toMatchObject({ ticketNumber: 'SUP-AAAAAAAA', status: 'open', userId });
    await store.createTicket({ ...base, userId, ticketNumber: 'SUP-BBBBBBBB' });
    await store.createTicket({ ...base, userId: null, ticketNumber: 'SUP-CCCCCCCC' });
    const mine = await store.listTicketsForUser(userId);
    expect(mine.map((t) => t.ticketNumber)).toEqual(['SUP-BBBBBBBB', 'SUP-AAAAAAAA']);
    expect(await store.listTicketsForUser(newUserId())).toEqual([]);
  });

  it('stores an address book per user and keeps optional fields optional', async () => {
    const a = { id: 'a1', name: 'Asha', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN', isDefault: true };
    const b = { id: 'a2', name: 'Asha', line1: '2 Side St', line2: 'Flat 4', city: 'Pune', state: 'MH', postalCode: '411002', country: 'IN', isDefault: false };
    expect(await store.getAddresses(userId)).toEqual([]);
    await store.setAddresses(userId, [a, b]);
    expect(await store.getAddresses(userId)).toEqual([a, b]);
    expect(await store.getAddresses(newUserId())).toEqual([]);
    await store.setAddresses(userId, []);
    expect(await store.getAddresses(userId)).toEqual([]);
  });

  it('stores a wishlist as ordered catalogue ids per user and clears it when emptied', async () => {
    expect(await store.getWishlistIds(userId)).toEqual([]);
    await store.setWishlistIds(userId, ['B2', 'A1']);
    expect(await store.getWishlistIds(userId)).toEqual(['B2', 'A1']);
    expect(await store.getWishlistIds(newUserId())).toEqual([]);
    await store.setWishlistIds(userId, []);
    expect(await store.getWishlistIds(userId)).toEqual([]);
  });

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
