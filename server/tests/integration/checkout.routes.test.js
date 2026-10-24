import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { createCommerce } from '../../src/services/commerce/index.js';
import { createMemoryCommerceStore } from '../../src/services/commerce/memoryStore.js';
import { createDemoProvider } from '../../src/services/payments/demoProvider.js';
import { createHarness, SECRET } from '../helpers/authHarness.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', JWT_SECRET: SECRET });
const catalog = createCatalog(rawFixture);
const address = { name: 'Asha Kulkarni', line1: '12 Garden Road', city: 'Pune', state: 'MH', postalCode: '411001', country: 'in' };

function setup({ provider = createDemoProvider() } = {}) {
  const h = createHarness();
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider });
  const app = createApp(env, { catalog, authService: h.service, commerce });
  return { h, app, commerce };
}

async function signIn(app, h, email = 'asha@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Asha', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}

const fillCart = (agent, items = [['A4', 2]]) =>
  Promise.all(items.map(([id, qty]) => agent.put(`/api/cart/items/${id}`).send({ qty }).expect(200)));
const startCheckout = (agent, body = { address }) => agent.post('/api/checkout/sessions').send(body);
const simulate = (agent, id, outcome) => agent.post(`/api/checkout/sessions/${id}/simulate`).send({ outcome });

describe('access control', () => {
  it('keeps guests out of the account cart, checkout and orders', async () => {
    const { app } = setup();
    for (const [method, path] of [['get', '/api/cart'], ['put', '/api/cart/items/A1'], ['post', '/api/cart/merge'], ['post', '/api/checkout/sessions'], ['get', '/api/checkout/sessions/x'], ['post', '/api/checkout/sessions/x/simulate'], ['get', '/api/orders'], ['get', '/api/orders/x']]) {
      expect((await request(app)[method](path).send({})).status, `${method} ${path}`).toBe(401);
    }
  });
});

describe('cart', () => {
  it('quotes a guest cart from catalogue prices only', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/cart/quote').send({ items: [{ productId: 'A4', qty: 2, priceCents: 1, totalCents: 1 }, { productId: 'NOPE', qty: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.cart.totals).toEqual({ subtotalCents: 3998, shippingCents: 599, totalCents: 4597 });
    expect(res.body.cart.issues).toEqual([expect.objectContaining({ productId: 'NOPE', reason: 'UNAVAILABLE' })]);
  });

  it('rejects malformed quote bodies', async () => {
    const { app } = setup();
    for (const body of [{}, { items: 'x' }, { items: [{ productId: 'A1', qty: 0 }] }, { items: [{ productId: 'A1', qty: 100 }] }, { items: [{ productId: '../etc', qty: 1 }] }]) {
      expect((await request(app).post('/api/cart/quote').send(body)).status).toBe(400);
    }
  });

  it('sets, updates, removes and clears items for the signed-in user', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    expect((await agent.get('/api/cart')).body.cart.itemCount).toBe(0);
    await fillCart(agent, [['A4', 2], ['A1', 1]]);
    await agent.put('/api/cart/items/A4').send({ qty: 3 }).expect(200);
    let cart = (await agent.get('/api/cart')).body.cart;
    expect(cart.lines.map((l) => [l.productId, l.qty]).sort()).toEqual([['A1', 1], ['A4', 3]]);
    expect(cart.totals.subtotalCents).toBe(4999 + 3 * 1999);
    cart = (await agent.delete('/api/cart/items/A1')).body.cart;
    expect(cart.lines).toHaveLength(1);
    expect((await agent.delete('/api/cart')).body.cart.itemCount).toBe(0);
  });

  it('refuses unknown products and bad quantities', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    expect((await agent.put('/api/cart/items/NOPE').send({ qty: 1 })).status).toBe(404);
    for (const qty of [0, -1, 1.5, 100, '2', null]) expect((await agent.put('/api/cart/items/A1').send({ qty })).status).toBe(400);
  });

  it('keeps each user\'s cart separate', async () => {
    const { app, h } = setup();
    const asha = await signIn(app, h, 'asha@example.com');
    const ravi = await signIn(app, h, 'ravi@example.com');
    await fillCart(asha);
    expect((await ravi.get('/api/cart')).body.cart.itemCount).toBe(0);
  });

  it('merges a guest cart, adding quantities and reporting what could not be merged', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent, [['A4', 98]]);
    const res = await agent.post('/api/cart/merge').send({ items: [{ productId: 'A4', qty: 5 }, { productId: 'A1', qty: 1 }, { productId: 'NOPE', qty: 1 }] });
    expect(res.status).toBe(200);
    expect(res.body.skipped).toEqual(expect.arrayContaining([{ productId: 'NOPE', reason: 'UNAVAILABLE' }, { productId: 'A4', reason: 'QUANTITY_LIMITED' }]));
    const qty = Object.fromEntries(res.body.cart.lines.map((l) => [l.productId, l.qty]));
    expect(qty).toEqual({ A4: 99, A1: 1 });
  });
});

describe('demo checkout', () => {
  it('reports that payments are simulated', async () => {
    const { app } = setup();
    const res = await request(app).get('/api/checkout/config');
    expect(res.body).toEqual({ provider: 'demo', demo: true, label: 'Demo Mode — No Real Money Charged' });
  });

  it('refuses an empty cart and an invalid address', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    const empty = await startCheckout(agent);
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe('CART_EMPTY');
    await fillCart(agent);
    for (const bad of [{}, { address: { ...address, name: '' } }, { address: { ...address, postalCode: '<>' } }, { address: { ...address, country: 'India' } }, { address: { ...address, line1: 'x'.repeat(121) } }]) {
      expect((await startCheckout(agent, bad)).status).toBe(400);
    }
  });

  it('prices the session on the server and ignores amounts sent by the browser', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent, [['A4', 2]]);
    const res = await startCheckout(agent, { address, totalCents: 1, subtotalCents: 1, items: [{ productId: 'A4', unitPriceCents: 1, qty: 1 }] });
    expect(res.status).toBe(201);
    expect(res.body.session).toMatchObject({ status: 'pending', subtotalCents: 3998, shippingCents: 599, totalCents: 4597, payment: { provider: 'demo', demo: true } });
    expect(res.body.session.items).toEqual([expect.objectContaining({ productId: 'A4', qty: 2, unitPriceCents: 1999 })]);
    expect(res.body.session.shippingAddress.country).toBe('IN');
    expect(res.body.redirect).toEqual({ type: 'internal', path: `/checkout/pay/${res.body.session.id}` });
  });

  it('refuses checkout when the cart holds a product that is no longer available', async () => {
    const { app, h, commerce } = setup();
    const agent = await signIn(app, h);
    const me = (await agent.get('/api/auth/me')).body.user;
    await commerce.store.setCartItems(me.id, [{ productId: 'A4', qty: 1 }, { productId: 'GONE', qty: 1 }]);
    const res = await startCheckout(agent);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('CART_INVALID');
  });

  it('creates the order only after a simulated success, then clears the cart', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent, [['A4', 2]]);
    const { body: { session } } = await startCheckout(agent);
    expect((await agent.get('/api/orders')).body.orders).toEqual([]); // nothing yet: paying has not happened

    const paid = await simulate(agent, session.id, 'success');
    expect(paid.status).toBe(200);
    expect(paid.body.demo).toBe(true);
    const order = paid.body.order;
    expect(order).toMatchObject({ status: 'paid', subtotalCents: 3998, shippingCents: 599, totalCents: 4597, payment: { provider: 'demo', demo: true } });
    expect(order.orderNumber).toMatch(/^CRT-[A-Z0-9]{8}$/);
    expect(order.items[0]).toMatchObject({ productId: 'A4', qty: 2, unitPriceCents: 1999 });
    expect(order.payment.provider).not.toBe('stripe');
    expect(JSON.stringify(order)).not.toMatch(/stripe/i);

    expect((await agent.get('/api/cart')).body.cart.itemCount).toBe(0);
    expect((await agent.get(`/api/orders/${order.id}`)).body.order.orderNumber).toBe(order.orderNumber);
    expect((await agent.get('/api/orders')).body.orders).toHaveLength(1);
  });

  it('is idempotent: repeating the success never creates a second order', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent);
    const { body: { session } } = await startCheckout(agent);
    const first = await simulate(agent, session.id, 'success');
    const again = await Promise.all([simulate(agent, session.id, 'success'), simulate(agent, session.id, 'success')]);
    for (const res of again) expect(res.body.order.id).toBe(first.body.order.id);
    expect((await agent.get('/api/orders')).body.orders).toHaveLength(1);
  });

  it('keeps items added after checkout started when the order completes', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent, [['A4', 2]]);
    const { body: { session } } = await startCheckout(agent);
    await agent.put('/api/cart/items/A1').send({ qty: 1 }).expect(200);
    await agent.put('/api/cart/items/A4').send({ qty: 3 }).expect(200);
    await simulate(agent, session.id, 'success').expect(200);
    const lines = (await agent.get('/api/cart')).body.cart.lines.map((l) => [l.productId, l.qty]).sort();
    expect(lines).toEqual([['A1', 1], ['A4', 1]]);
  });

  it('keeps the cart and creates no order when the simulated payment fails', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent, [['A4', 2]]);
    const { body: { session } } = await startCheckout(agent);
    const failed = await simulate(agent, session.id, 'failure');
    expect(failed.status).toBe(200);
    expect(failed.body.order).toBeNull();
    expect(failed.body.session).toMatchObject({ status: 'failed' });
    expect(failed.body.session.failureReason).toMatch(/nothing was charged/i);
    expect((await agent.get('/api/cart')).body.cart.itemCount).toBe(2);
    expect((await agent.get('/api/orders')).body.orders).toEqual([]);
    // A failed attempt cannot later turn into an order; the buyer starts a new checkout instead.
    expect((await simulate(agent, session.id, 'success')).status).toBe(409);
    const retry = await startCheckout(agent);
    expect(retry.status).toBe(201);
    expect((await simulate(agent, retry.body.session.id, 'success')).body.order.status).toBe('paid');
  });

  it('does not let a paid session be marked failed', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent);
    const { body: { session } } = await startCheckout(agent);
    await simulate(agent, session.id, 'success').expect(200);
    expect((await simulate(agent, session.id, 'failure')).status).toBe(409);
  });

  it('rejects unknown outcomes', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h);
    await fillCart(agent);
    const { body: { session } } = await startCheckout(agent);
    for (const outcome of ['maybe', '', undefined, 'succeeded']) expect((await simulate(agent, session.id, outcome)).status).toBe(400);
  });

  it('shows sessions and orders only to their owner', async () => {
    const { app, h } = setup();
    const asha = await signIn(app, h, 'asha@example.com');
    const ravi = await signIn(app, h, 'ravi@example.com');
    await fillCart(asha);
    const { body: { session } } = await startCheckout(asha);
    expect((await ravi.get(`/api/checkout/sessions/${session.id}`)).status).toBe(404);
    expect((await simulate(ravi, session.id, 'success')).status).toBe(404);
    const { body: { order } } = await simulate(asha, session.id, 'success');
    expect((await ravi.get(`/api/orders/${order.id}`)).status).toBe(404);
    expect((await ravi.get('/api/orders')).body.orders).toEqual([]);
    expect((await asha.get(`/api/orders/${order.id}`)).status).toBe(200);
  });
});

describe('replacing the demo provider', () => {
  it('has no simulate route when the provider is not the demo provider', async () => {
    const real = { name: 'stripe', isDemo: false, label: null, startCheckout: async (s) => ({ redirect: { type: 'external', url: `https://pay.example/${s.id}` } }) };
    const { app, h } = setup({ provider: real });
    const agent = await signIn(app, h);
    await fillCart(agent);
    const started = await startCheckout(agent);
    expect(started.body.redirect).toEqual({ type: 'external', url: `https://pay.example/${started.body.session.id}` });
    expect((await simulate(agent, started.body.session.id, 'success')).status).toBe(404);
    expect((await request(app).get('/api/checkout/config')).body).toMatchObject({ provider: 'stripe', demo: false });
  });
});
