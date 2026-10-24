import { describe, it, expect, vi } from 'vitest';
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

function setup({ mailer = { send: vi.fn().mockResolvedValue(undefined) } } = {}) {
  const h = createHarness();
  const catalog = createCatalog(rawFixture);
  const log = { error: vi.fn() };
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider: createDemoProvider(), mailer, appUrl: 'https://shop.example.com', log });
  return { h, app: createApp(env, { catalog, authService: h.service, commerce }), catalog, mailer, log, commerce };
}
async function signIn(app, h, email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Person', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}
async function placeOrder(app, h, { sellerProduct = false, buyerEmail = 'buyer@example.com' } = {}) {
  const buyer = await signIn(app, h, buyerEmail);
  let seller = null;
  let id = 'A4';
  if (sellerProduct) {
    seller = await signIn(app, h, 'seller@example.com');
    await seller.post('/api/seller/activate').send({ storeName: 'Asha Crafts' }).expect(200);
    const slug = (await request(app).get('/api/categories')).body.categories[0].slug;
    id = (await seller.post('/api/seller/products').send({ title: 'Hand-made Mug', category: slug, price: 24.5, stockQty: 5, imageUrls: ['https://i.example.com/a.jpg'] }).expect(201)).body.product.id;
  }
  await buyer.put(`/api/cart/items/${id}`).send({ qty: 2 }).expect(200);
  const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
  const order = (await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'success' }).expect(200)).body.order;
  return { buyer, seller, order };
}

describe('notifications', () => {
  it('requires sign-in', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/notifications')).status).toBe(401);
    expect((await request(app).post('/api/notifications/read')).status).toBe(401);
  });

  it('tells the buyer an order is confirmed, once, and lets them mark everything read', async () => {
    const { app, h } = setup();
    const { buyer, order } = await placeOrder(app, h);
    const first = (await buyer.get('/api/notifications').expect(200)).body;
    expect(first.unread).toBe(1);
    expect(first.items).toEqual([expect.objectContaining({ type: 'order_paid', title: 'Order confirmed', link: `/orders/${order.id}`, read: false })]);
    expect(first.items[0].message).toContain(order.orderNumber);
    expect(first.items[0].message).toMatch(/no real money was charged/);
    const after = (await buyer.post('/api/notifications/read').expect(200)).body;
    expect(after.unread).toBe(0);
    expect(after.items[0].read).toBe(true);
  });

  it('keeps notifications private', async () => {
    const { app, h } = setup();
    await placeOrder(app, h);
    const other = await signIn(app, h, 'other@example.com');
    expect((await other.get('/api/notifications')).body).toEqual({ items: [], unread: 0 });
  });

  it('alerts the seller to a new order and the buyer when it ships, but not twice', async () => {
    const { app, h } = setup();
    const { buyer, seller, order } = await placeOrder(app, h, { sellerProduct: true });
    const sellerNotes = (await seller.get('/api/notifications')).body;
    expect(sellerNotes.items[0]).toMatchObject({ type: 'new_order', link: '/sell/orders' });
    await seller.post(`/api/seller/orders/${order.id}/ship`).expect(200);
    await seller.post(`/api/seller/orders/${order.id}/ship`).expect(200);
    const buyerNotes = (await buyer.get('/api/notifications')).body;
    expect(buyerNotes.items.filter((n) => n.type === 'order_status')).toHaveLength(1);
    expect(buyerNotes.items[0]).toMatchObject({ title: 'Items shipped', link: `/orders/${order.id}` });
  });

  it('does not notify on a failed payment', async () => {
    const { app, h } = setup();
    const buyer = await signIn(app, h, 'fail@example.com');
    await buyer.put('/api/cart/items/A4').send({ qty: 1 }).expect(200);
    const session = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'failure' }).expect(200);
    expect((await buyer.get('/api/notifications')).body.unread).toBe(0);
  });
});

describe('order confirmation email', () => {
  it('goes to the account email with the demo label and a link, and is sent once', async () => {
    const { app, h, mailer } = setup();
    const { buyer, order } = await placeOrder(app, h, { buyerEmail: 'Buyer@Example.com' });
    expect(mailer.send).toHaveBeenCalledTimes(1);
    const mail = mailer.send.mock.calls[0][0];
    expect(mail.to).toBe('buyer@example.com');
    expect(mail.subject).toBe(`Your Cartora order ${order.orderNumber}`);
    expect(mail.text).toContain('Demo Mode — No Real Money Charged');
    expect(mail.text).toContain(`https://shop.example.com/orders/${order.id}`);
    expect(mail.text).not.toMatch(/stripe/i);
    expect((await buyer.get('/api/orders').expect(200)).body.orders).toHaveLength(1);
  });

  it('never fails the order when the email cannot be sent', async () => {
    const mailer = { send: vi.fn().mockRejectedValue(new Error('invalid_grant')) };
    const { app, h, log } = setup({ mailer });
    const { buyer, order } = await placeOrder(app, h);
    expect((await buyer.get(`/api/orders/${order.id}`)).status).toBe(200);
    expect(log.error).toHaveBeenCalledWith(expect.stringContaining(order.orderNumber));
    expect((await buyer.get('/api/notifications')).body.unread).toBe(1);
  });
});
