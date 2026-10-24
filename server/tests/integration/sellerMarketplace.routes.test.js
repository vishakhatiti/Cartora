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
const address = { name: 'Buyer', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' };

function setup() {
  const h = createHarness();
  const catalog = createCatalog(rawFixture);
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider: createDemoProvider() });
  const app = createApp(env, { catalog, authService: h.service, commerce });
  return { h, app, catalog, commerce, category: catalog.categories[0].slug };
}
async function signIn(app, h, email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Person', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}
async function seller(app, h, email, store = 'Asha Crafts') {
  const agent = await signIn(app, h, email);
  await agent.post('/api/seller/activate').send({ storeName: store }).expect(200);
  return agent;
}
const product = (category, over = {}) => ({ title: 'Hand-made Mug', brand: 'Asha', category, price: 24.5, stockQty: 3, description: 'A mug.', features: ['Dishwasher safe'], imageUrls: ['https://images.example.com/mug.jpg'], ...over });

describe('seller access', () => {
  it('keeps guests and ordinary customers out of every seller endpoint', async () => {
    const { app, h } = setup();
    const customer = await signIn(app, h, 'c@example.com');
    for (const [m, p] of [['get', '/api/seller/summary'], ['get', '/api/seller/products'], ['post', '/api/seller/products'], ['put', '/api/seller/products/S1'], ['get', '/api/seller/orders'], ['post', '/api/seller/orders/x/ship']]) {
      expect((await request(app)[m](p).send({})).status, `guest ${m} ${p}`).toBe(401);
      expect((await customer[m](p).send({})).status, `customer ${m} ${p}`).toBe(403);
    }
  });
});

describe('listings', () => {
  it('publishes a product that shoppers can find, with the seller named and real stock', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const created = await s.post('/api/seller/products').send(product(category)).expect(201);
    expect(created.body.product).toMatchObject({ title: 'Hand-made Mug', priceCents: 2450, stockQty: 3, isActive: true });
    const id = created.body.product.id;
    const found = await request(app).get('/api/products').query({ q: 'mug' });
    expect(found.body.items.map((p) => p.id)).toContain(id);
    const detail = await request(app).get(`/api/products/${id}`);
    expect(detail.body.product).toMatchObject({ storeName: 'Asha Crafts', stockQty: 3, finalPriceCents: 2450 });
    expect(detail.body.product).not.toHaveProperty('sellerId'.replace('sellerId', 'passwordHash'));
    const shelf = await request(app).get('/api/discover/new-releases');
    expect(shelf.body.items[0].id).toBe(id);
  });

  it('validates every field on the server', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const bad = [
      { title: 'ab' }, { category: 'not-a-category' }, { price: 0 }, { price: -5 }, { price: 'abc' }, { stockQty: -1 }, { stockQty: 1.5 },
      { imageUrls: [] }, { imageUrls: ['http://insecure.example.com/a.jpg'] }, { imageUrls: ['javascript:alert(1)'] }, { imageUrls: Array(5).fill('https://a.example.com/x.jpg') },
      { features: Array(9).fill('x') }, { description: 'x'.repeat(4001) },
    ];
    for (const over of bad) expect((await s.post('/api/seller/products').send(product(category, over))).status, JSON.stringify(over).slice(0, 60)).toBe(400);
  });

  it('lets only the owner edit, and deactivating removes it from the shop', async () => {
    const { app, h, category } = setup();
    const owner = await seller(app, h, 'o@example.com', 'Owner Store');
    const rival = await seller(app, h, 'r@example.com', 'Rival Store');
    const id = (await owner.post('/api/seller/products').send(product(category))).body.product.id;
    expect((await rival.put(`/api/seller/products/${id}`).send({ price: 1 })).status).toBe(404);
    expect((await rival.get('/api/seller/products')).body.products).toEqual([]);
    const edited = await owner.put(`/api/seller/products/${id}`).send({ price: 30, stockQty: 9, title: 'Mug v2' }).expect(200);
    expect(edited.body.product).toMatchObject({ priceCents: 3000, stockQty: 9, title: 'Mug v2' });
    expect((await request(app).get(`/api/products/${id}`)).body.product.finalPriceCents).toBe(3000);
    await owner.put(`/api/seller/products/${id}`).send({ isActive: false }).expect(200);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(404);
    expect((await owner.get('/api/seller/products')).body.products[0]).toMatchObject({ id, isActive: false });
    await owner.put(`/api/seller/products/${id}`).send({ isActive: true }).expect(200);
    expect((await request(app).get(`/api/products/${id}`)).status).toBe(200);
    expect((await owner.put(`/api/seller/products/${id}`).send({})).status).toBe(400);
  });

  it('reloads active listings into a fresh catalogue at startup', async () => {
    const { app, h, category, commerce } = setup();
    const s = await seller(app, h, 's@example.com');
    const id = (await s.post('/api/seller/products').send(product(category))).body.product.id;
    const hidden = (await s.post('/api/seller/products').send(product(category, { title: 'Hidden Mug' }))).body.product.id;
    await s.put(`/api/seller/products/${hidden}`).send({ isActive: false });
    const fresh = createCatalog(rawFixture);
    const loader = createCommerce({ store: commerce.store, getCatalog: () => fresh, provider: createDemoProvider() });
    expect(await loader.seller.hydrate()).toBe(1);
    expect(fresh.getById(id)).not.toBeNull();
    expect(fresh.getById(hidden)).toBeNull();
  });
});

describe('selling, stock and fulfilment', () => {
  async function buy(app, h, id, qty, email = 'buyer@example.com') {
    const buyer = await signIn(app, h, email);
    const put = await buyer.put(`/api/cart/items/${id}`).send({ qty });
    if (put.status !== 200) return { buyer, put };
    const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    const paid = await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'success' }).expect(200);
    return { buyer, order: paid.body.order, put };
  }

  it('takes stock only when a payment succeeds, never below what exists', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const id = (await s.post('/api/seller/products').send(product(category, { stockQty: 3 }))).body.product.id;
    const buyer = await signIn(app, h, 'b@example.com');
    expect((await buyer.put(`/api/cart/items/${id}`).send({ qty: 4 })).status).toBe(409); // more than stock
    await buyer.put(`/api/cart/items/${id}`).send({ qty: 2 }).expect(200);
    const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    expect((await request(app).get(`/api/products/${id}`)).body.product.stockQty).toBe(3); // a pending session reserves nothing
    await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'failure' }).expect(200);
    expect((await request(app).get(`/api/products/${id}`)).body.product.stockQty).toBe(3);
    const second = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    await buyer.post(`/api/checkout/sessions/${second.id}/simulate`).send({ outcome: 'success' }).expect(200);
    await buyer.post(`/api/checkout/sessions/${second.id}/simulate`).send({ outcome: 'success' }).expect(200); // a repeat changes nothing
    expect((await request(app).get(`/api/products/${id}`)).body.product.stockQty).toBe(1);
  });

  it('treats a sold-out listing as unavailable', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const id = (await s.post('/api/seller/products').send(product(category, { stockQty: 1 }))).body.product.id;
    await buy(app, h, id, 1);
    const other = await signIn(app, h, 'late@example.com');
    const res = await other.put(`/api/cart/items/${id}`).send({ qty: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/out of stock/i);
  });

  it('shows the seller only their items and lets them ship, which the buyer then sees', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const other = await seller(app, h, 'x@example.com', 'Other Store');
    const mine = (await s.post('/api/seller/products').send(product(category))).body.product.id;
    const { buyer, order } = await buy(app, h, mine, 2);
    expect(order.items[0]).toMatchObject({ storeName: 'Asha Crafts', fulfilment: 'pending' });
    expect(order.items[0]).not.toHaveProperty('sellerId');

    const orders = (await s.get('/api/seller/orders').expect(200)).body.orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ orderNumber: order.orderNumber, fulfilment: 'pending', subtotalCents: 4900, shippingAddress: expect.objectContaining({ city: 'Pune' }) });
    expect(JSON.stringify(orders)).not.toMatch(/buyer@example\.com/);
    expect((await other.get('/api/seller/orders')).body.orders).toEqual([]);
    expect((await other.post(`/api/seller/orders/${order.id}/ship`)).status).toBe(404);

    const summary = (await s.get('/api/seller/summary')).body.summary;
    expect(summary).toMatchObject({ products: { total: 1, active: 1, outOfStock: 0 }, orders: { total: 1, toShip: 1, shipped: 0 }, salesCents: 4900, demoOrders: 1 });

    const shipped = await s.post(`/api/seller/orders/${order.id}/ship`).expect(200);
    expect(shipped.body.order.fulfilment).toBe('shipped');
    await s.post(`/api/seller/orders/${order.id}/ship`).expect(200); // safe to repeat
    const seen = (await buyer.get(`/api/orders/${order.id}`)).body.order;
    expect(seen.status).toBe('shipped');
    expect(seen.items[0].fulfilment).toBe('shipped');
  });

  it('keeps an order with marketplace items at paid until everything has shipped', async () => {
    const { app, h, category } = setup();
    const s = await seller(app, h, 's@example.com');
    const mine = (await s.post('/api/seller/products').send(product(category))).body.product.id;
    const buyer = await signIn(app, h, 'mix@example.com');
    await buyer.put(`/api/cart/items/${mine}`).send({ qty: 1 }).expect(200);
    await buyer.put('/api/cart/items/A4').send({ qty: 1 }).expect(200);
    const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    const order = (await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'success' })).body.order;
    await s.post(`/api/seller/orders/${order.id}/ship`).expect(200);
    const seen = (await buyer.get(`/api/orders/${order.id}`)).body.order;
    expect(seen.status).toBe('paid');
    expect(seen.items.find((i) => i.productId === mine).fulfilment).toBe('shipped');
  });
});
