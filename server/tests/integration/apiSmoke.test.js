import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { createCommerce } from '../../src/services/commerce/index.js';
import { createMemoryCommerceStore } from '../../src/services/commerce/memoryStore.js';
import { createDemoProvider } from '../../src/services/payments/demoProvider.js';
import { createHarness, SECRET } from '../helpers/authHarness.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

/**
 * One pass over every public API route, in the order a real customer and seller would use them.
 * It is a safety net: if a route is renamed, removed or stops answering, this fails and names it.
 * Detailed behaviour (prices, stock, idempotency, access rules) is covered in the per-feature test files.
 */
const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', JWT_SECRET: SECRET });
const address = { name: 'Buyer', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' };
const ticket = { name: 'Buyer', email: 'buyer@example.com', topic: 'order', message: 'Where is my order, please help me with it.' };

describe('API smoke test: every route answers as designed', () => {
  const h = createHarness();
  const catalog = createCatalog(rawFixture);
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider: createDemoProvider() });
  const app = createApp(env, { catalog, authService: h.service, commerce });
  const signUp = async (email) => {
    const agent = request.agent(app);
    await agent.post('/api/auth/register').send({ name: 'Person', email, password: 'a-good-password' }).expect(202);
    await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
    return agent;
  };
  let pid; let category;
  beforeAll(async () => {
    pid = (await request(app).get('/api/products')).body.items[0].id;
    category = catalog.categories[0].slug;
  });

  it('public catalogue routes', async () => {
    const get = (p, status = 200) => request(app).get(p).expect(status);
    await get('/api/health');
    await get('/api/health/ready', 503); // no database in tests, so "not ready" is the right answer
    expect((await get('/api/categories')).body.categories.length).toBeGreaterThan(0);
    await get('/api/search/suggestions?q=a');
    await get(`/api/products?category=${category}&sort=rating&page=1`);
    await get(`/api/products/${pid}`); await get(`/api/products/${pid}/reviews`); await get(`/api/products/${pid}/related`);
    await get('/api/products/NOPE', 404);
    for (const kind of ['trending', 'best-sellers', 'new-releases']) expect((await get(`/api/discover/${kind}`)).body.basis).toBeTruthy();
    await get('/api/discover/bogus', 404);
    await get('/api/nope', 404);
    await request(app).post('/api/cart/quote').send({ items: [{ productId: pid, qty: 2 }] }).expect(200);
    expect((await get('/api/checkout/config')).body).toMatchObject({ demo: true });
    await request(app).post('/api/support/tickets').send(ticket).expect(201);
  });

  it('keeps guests out of private routes', async () => {
    for (const [m, p] of [['get', '/api/auth/me'], ['get', '/api/cart'], ['get', '/api/wishlist'], ['get', '/api/addresses'], ['get', '/api/orders'], ['get', '/api/notifications'], ['get', '/api/support/tickets'], ['post', '/api/checkout/sessions'], ['get', '/api/seller/summary']]) {
      expect((await request(app)[m](p).send({})).status, `${m} ${p}`).toBe(401);
    }
  });

  it('account routes: register, verify, login, code login, forgot, reset, logout', async () => {
    const email = 'tester@example.com';
    await request(app).post('/api/auth/register').send({ name: 'Tester', email, password: 'a-good-password' }).expect(202);
    await request(app).post('/api/auth/resend-verification').send({ email }).expect(202);
    const me = request.agent(app);
    await me.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
    await me.get('/api/auth/me').expect(200);
    await me.post('/api/auth/logout').expect(204);
    await request(app).post('/api/auth/login').send({ email, password: 'wrong-password-1' }).expect(401);
    await me.post('/api/auth/login').send({ email, password: 'a-good-password' }).expect(200);
    await request(app).post('/api/auth/login-code/request').send({ email }).expect(202);
    await request.agent(app).post('/api/auth/login-code/verify').send({ email, code: h.lastCode() }).expect(200);
    await request(app).post('/api/auth/forgot').send({ email }).expect(202);
    await request(app).post('/api/auth/reset').send({ email, code: h.lastCode(), newPassword: 'another-good-password' }).expect(200);
    expect((await request(app).post('/api/auth/google').send({ credential: 'x' })).status).toBeGreaterThanOrEqual(400); // not configured in tests
  });

  it('buyer routes: cart, wishlist, addresses, support, checkout, orders, notifications', async () => {
    const b = await signUp('buyer@example.com');
    await b.put(`/api/cart/items/${pid}`).send({ qty: 2 }).expect(200);
    await b.get('/api/cart').expect(200);
    await b.post('/api/cart/merge').send({ items: [] }).expect(200);
    await b.put(`/api/wishlist/items/${pid}`).expect(200);
    expect((await b.get('/api/wishlist').expect(200)).body.wishlist.ids).toContain(pid);
    await b.delete(`/api/wishlist/items/${pid}`).expect(200);
    await b.post('/api/addresses').send({ address, makeDefault: true }).expect(201);
    const id = (await b.get('/api/addresses').expect(200)).body.addresses[0].id;
    await b.put(`/api/addresses/${id}`).send({ address: { ...address, city: 'Mumbai' } }).expect(200);
    await b.post(`/api/addresses/${id}/default`).expect(200);
    await b.delete(`/api/addresses/${id}`).expect(200);
    await b.post('/api/support/tickets').send(ticket).expect(201);
    await b.get('/api/support/tickets').expect(200);

    const failed = (await b.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    await b.get(`/api/checkout/sessions/${failed.id}`).expect(200);
    expect((await b.post(`/api/checkout/sessions/${failed.id}/simulate`).send({ outcome: 'failure' }).expect(200)).body.order).toBeNull();
    const paying = (await b.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    const paid = (await b.post(`/api/checkout/sessions/${paying.id}/simulate`).send({ outcome: 'success' }).expect(200)).body.order;
    expect((await b.get('/api/orders').expect(200)).body.orders).toHaveLength(1);
    await b.get(`/api/orders/${paid.id}`).expect(200);
    await (await signUp('other@example.com')).get(`/api/orders/${paid.id}`).expect(404); // not someone else's order
    await b.get('/api/notifications').expect(200);
    await b.post('/api/notifications/read').send({}).expect(200);
    await b.delete('/api/cart').expect(200);
  });

  it('seller routes: activate, list, publish, edit, orders, ship', async () => {
    const s = await signUp('seller@example.com');
    await s.get('/api/seller/me').expect(403); // a customer is not a seller yet
    await s.post('/api/seller/activate').send({ storeName: 'Asha Crafts' }).expect(200);
    await s.get('/api/seller/me').expect(200);
    await s.get('/api/seller/summary').expect(200);
    const made = await s.post('/api/seller/products').send({ title: 'Hand-made Mug', brand: 'Asha', category, price: 24.5, stockQty: 3, description: 'A mug.', features: ['Dishwasher safe'], imageUrls: ['https://images.example.com/mug.jpg'] }).expect(201);
    const lid = made.body.product.id;
    await s.get('/api/seller/products').expect(200);
    await s.put(`/api/seller/products/${lid}`).send({ price: 30, stockQty: 5 }).expect(200);
    await request(app).get(`/api/products/${lid}`).expect(200); // shoppers can see it

    const buyer = await signUp('shopper@example.com');
    await buyer.put(`/api/cart/items/${lid}`).send({ qty: 1 }).expect(200);
    const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'success' }).expect(200);
    const orders = (await s.get('/api/seller/orders').expect(200)).body.orders;
    expect(JSON.stringify(orders)).not.toContain('shopper@example.com'); // sellers never get the buyer's email
    await s.post(`/api/seller/orders/${orders[0].id}/ship`).send({}).expect(200);
  });
});
