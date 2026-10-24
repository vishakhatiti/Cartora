import { vi } from 'vitest';
import { ApiError } from '../lib/api.js';

export const PRICES = {
  B0TEST0001: { title: 'Noise-cancelling Headphones', brand: 'Acme', priceCents: 5999 },
  B0TEST0002: { title: 'Paperback Novel', brand: 'Inkwell', priceCents: 1200 },
};

const price = (items) => {
  const lines = [], issues = [];
  for (const { productId, qty } of items) {
    const p = PRICES[productId];
    if (!p) { issues.push({ productId, code: 'UNAVAILABLE' }); continue; }
    lines.push({ productId, qty, title: p.title, brand: p.brand, unitPriceCents: p.priceCents, image: null, category: null });
  }
  const subtotalCents = lines.reduce((n, l) => n + l.unitPriceCents * l.qty, 0);
  const shippingCents = lines.length === 0 || subtotalCents >= 5000 ? 0 : 599;
  return { lines, issues, itemCount: lines.reduce((n, l) => n + l.qty, 0), totals: { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents } };
};

/**
 * A stateful stand-in for the commerce API. Like the real server it prices everything itself,
 * keeps the account cart, and only creates an order when a payment is simulated as a success.
 * Every method is a spy, and tests can override any of them.
 */
export function fakeCommerce(overrides = {}) {
  let serverItems = [];
  const sessions = new Map();
  const orders = new Map();
  let wishIds = [];
  const wishOf = () => ({ wishlist: { ids: [...wishIds], count: wishIds.length, items: wishIds.map((id) => ({ id, title: PRICES[id]?.title ?? id, brand: PRICES[id]?.brand ?? '', category: { slug: 'electronics', label: 'Electronics' }, priceCents: PRICES[id]?.priceCents ?? 100, finalPriceCents: PRICES[id]?.priceCents ?? 100, deal: null, images: [], ratingAvg: 4, ratingCount: 1 })) } });
  let book = [];
  const tickets = [];
  const bookOf = () => ({ addresses: book.map((a) => ({ ...a })) });
  const cartOf = () => ({ cart: price(serverItems) });
  const api = {
    state: { get items() { return serverItems; }, get wishlist() { return wishIds; }, get addresses() { return book; }, sessions, orders },
    quote: vi.fn((items) => Promise.resolve({ cart: price(items) })),
    getCart: vi.fn(() => Promise.resolve(cartOf())),
    setQuantity: vi.fn((productId, qty) => {
      serverItems = [...serverItems.filter((i) => i.productId !== productId), { productId, qty }];
      return Promise.resolve(cartOf());
    }),
    removeItem: vi.fn((productId) => { serverItems = serverItems.filter((i) => i.productId !== productId); return Promise.resolve(cartOf()); }),
    merge: vi.fn((items) => {
      const skipped = items.filter((i) => !PRICES[i.productId]);
      for (const i of items.filter((x) => PRICES[x.productId])) {
        const have = serverItems.find((s) => s.productId === i.productId)?.qty ?? 0;
        serverItems = [...serverItems.filter((s) => s.productId !== i.productId), { productId: i.productId, qty: Math.min(99, have + i.qty) }];
      }
      return Promise.resolve({ ...cartOf(), merged: items.length - skipped.length, skipped });
    }),
    getWishlist: vi.fn(() => Promise.resolve(wishOf())),
    addWishlist: vi.fn((id) => { wishIds = [id, ...wishIds.filter((x) => x !== id)]; return Promise.resolve(wishOf()); }),
    removeWishlist: vi.fn((id) => { wishIds = wishIds.filter((x) => x !== id); return Promise.resolve(wishOf()); }),
    listAddresses: vi.fn(() => Promise.resolve(bookOf())),
    addAddress: vi.fn((address, makeDefault = false) => {
      if (makeDefault || book.length === 0) book = book.map((a) => ({ ...a, isDefault: false }));
      book = [...book, { ...address, id: `addr_${book.length + 1}`, isDefault: makeDefault || book.length === 0 }];
      return Promise.resolve(bookOf());
    }),
    updateAddress: vi.fn((id, address) => { book = book.map((a) => (a.id === id ? { ...address, id, isDefault: a.isDefault } : a)); return Promise.resolve(bookOf()); }),
    setDefaultAddress: vi.fn((id) => { book = book.map((a) => ({ ...a, isDefault: a.id === id })); return Promise.resolve(bookOf()); }),
    deleteAddress: vi.fn((id) => {
      const wasDefault = book.find((a) => a.id === id)?.isDefault;
      book = book.filter((a) => a.id !== id);
      if (wasDefault && book[0]) book[0] = { ...book[0], isDefault: true };
      return Promise.resolve(bookOf());
    }),
    createTicket: vi.fn((data) => {
      const ticket = { id: `t${tickets.length + 1}`, ticketNumber: 'SUP-TESTTICK', topic: data.topic, orderNumber: data.orderNumber ?? null, message: data.message, status: 'open', createdAt: '2026-10-24T10:00:00.000Z' };
      tickets.unshift(ticket);
      return Promise.resolve({ ticket });
    }),
    listTickets: vi.fn(() => Promise.resolve({ tickets: [...tickets] })),
    checkoutConfig: vi.fn(() => Promise.resolve({ provider: 'demo', demo: true, label: 'Demo Mode — No Real Money Charged' })),
    startCheckout: vi.fn((address) => {
      const cart = price(serverItems);
      if (cart.lines.length === 0) return Promise.reject(new ApiError(400, 'CART_EMPTY', 'Your cart is empty.'));
      const id = `sess_${sessions.size + 1}`;
      sessions.set(id, { id, status: 'pending', items: cart.lines, ...cart.totals, currency: 'usd', shippingAddress: address, failureReason: null, orderId: null, payment: { provider: 'demo', demo: true, label: 'Demo Mode — No Real Money Charged' } });
      return Promise.resolve({ session: sessions.get(id), redirect: { type: 'internal', path: `/checkout/pay/${id}` } });
    }),
    getSession: vi.fn((id) => (sessions.has(id) ? Promise.resolve({ session: sessions.get(id) }) : Promise.reject(new ApiError(404, 'NOT_FOUND', 'Not found.')))),
    simulate: vi.fn((id, outcome) => {
      const s = sessions.get(id);
      if (!s) return Promise.reject(new ApiError(404, 'NOT_FOUND', 'Not found.'));
      if (outcome === 'failure') {
        s.status = 'failed';
        s.failureReason = 'Demo payment declined. This was a simulated failure and nothing was charged.';
        return Promise.resolve({ demo: true, session: s, order: null });
      }
      s.status = 'succeeded';
      const order = { id: `ord_${orders.size + 1}`, orderNumber: 'CRT-TESTORDR', status: 'paid', items: s.items, subtotalCents: s.subtotalCents, shippingCents: s.shippingCents, totalCents: s.totalCents, currency: 'usd', shippingAddress: s.shippingAddress, payment: { provider: 'demo', demo: true }, createdAt: '2026-10-24T10:00:00.000Z' };
      orders.set(order.id, order);
      s.orderId = order.id;
      serverItems = [];
      return Promise.resolve({ demo: true, session: s, order });
    }),
    listOrders: vi.fn(() => Promise.resolve({ orders: [...orders.values()].reverse() })),
    getOrder: vi.fn((id) => (orders.has(id) ? Promise.resolve({ order: orders.get(id) }) : Promise.reject(new ApiError(404, 'NOT_FOUND', 'Order not found.')))),
  };
  return Object.assign(api, overrides);
}
