import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import Stripe from 'stripe';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { createCommerce } from '../../src/services/commerce/index.js';
import { createMemoryCommerceStore } from '../../src/services/commerce/memoryStore.js';
import { createStripeProvider } from '../../src/services/payments/stripeProvider.js';
import { createPaymentProvider } from '../../src/services/payments/index.js';
import { createHarness, SECRET } from '../helpers/authHarness.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const WEBHOOK_SECRET = 'whsec_test_secret_for_unit_tests';
const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'https://shop.example.com', JWT_SECRET: SECRET });
const address = { name: 'Buyer', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' };
const signer = new Stripe('sk_test_unused'); // used only to build real signatures; makes no network call

function setup() {
  const h = createHarness();
  const catalog = createCatalog(rawFixture);
  // Only the network is faked. Signature checking runs through the real Stripe library.
  const fake = {
    checkout: { sessions: { create: vi.fn(async () => ({ url: 'https://checkout.stripe.test/pay/cs_test_1' })) } },
    refunds: { create: vi.fn(async () => ({ id: 're_1' })) },
    webhooks: new Stripe('sk_test_unused').webhooks,
  };
  const provider = createStripeProvider({ secretKey: 'sk_test_unused', webhookSecret: WEBHOOK_SECRET, appUrl: 'https://shop.example.com/', stripe: fake });
  const log = { warn: vi.fn(), error: vi.fn() };
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider, log });
  const app = createApp(env, { catalog, authService: h.service, commerce });
  return { h, app, fake, commerce };
}
async function signIn(app, h, email = 'buyer@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Person', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}
async function startCheckout(app, h, email) {
  const buyer = await signIn(app, h, email);
  await buyer.put('/api/cart/items/A4').send({ qty: 2 }).expect(200);
  const body = (await buyer.post('/api/checkout/sessions').send({ address }).expect(201)).body;
  return { buyer, session: body.session, redirect: body.redirect };
}
const event = (type, obj, id = 'evt_1') => JSON.stringify({ id, object: 'event', type, data: { object: obj } });
const send = (app, payload, secret = WEBHOOK_SECRET) => {
  const header = signer.webhooks.generateTestHeaderString({ payload, secret });
  return request(app).post('/api/webhooks/stripe').set('content-type', 'application/json').set('stripe-signature', header).send(payload);
};
const paidObject = (session, over = {}) => ({ client_reference_id: session.id, payment_status: 'paid', amount_total: session.totalCents, currency: 'usd', payment_intent: 'pi_1', ...over });

describe('Stripe provider', () => {
  it('sends the buyer to Stripe with server-priced lines, never browser prices', async () => {
    const { app, h, fake } = setup();
    const { session, redirect } = await startCheckout(app, h);
    expect(redirect).toEqual({ type: 'external', url: 'https://checkout.stripe.test/pay/cs_test_1' });
    const [params, opts] = fake.checkout.sessions.create.mock.calls[0];
    expect(params).toMatchObject({ mode: 'payment', client_reference_id: session.id, success_url: `https://shop.example.com/checkout/return/${session.id}`, cancel_url: 'https://shop.example.com/cart' });
    expect(params.line_items[0]).toMatchObject({ quantity: 2, price_data: { currency: 'usd', unit_amount: session.items[0].unitPriceCents } });
    expect(opts.idempotencyKey).toContain(session.id);
    const lineTotal = params.line_items.reduce((n, l) => n + l.quantity * l.price_data.unit_amount, 0);
    const shipping = params.shipping_options?.[0].shipping_rate_data.fixed_amount.amount ?? 0;
    expect(lineTotal + shipping).toBe(session.totalCents);
  });

  it('is chosen by configuration and refuses to start without both keys', () => {
    expect(() => createPaymentProvider({ PAYMENT_PROVIDER: 'stripe' })).toThrow(/STRIPE_SECRET_KEY/);
    expect(() => createPaymentProvider({ PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x' })).toThrow(/STRIPE_WEBHOOK_SECRET/);
    expect(createPaymentProvider({ PAYMENT_PROVIDER: 'stripe', STRIPE_SECRET_KEY: 'sk_test_x', STRIPE_WEBHOOK_SECRET: 'whsec_x', FRONTEND_URL: 'https://a.test' }).isDemo).toBe(false);
  });

  it('has no simulate route and reports itself as not demo', async () => {
    const { app, h } = setup();
    const { buyer, session } = await startCheckout(app, h);
    expect((await request(app).get('/api/checkout/config')).body).toMatchObject({ provider: 'stripe', demo: false });
    expect((await buyer.post(`/api/checkout/sessions/${session.id}/simulate`).send({ outcome: 'success' })).status).toBe(404);
  });
});

describe('Stripe webhook', () => {
  it('rejects a missing or wrong signature and creates nothing', async () => {
    const { app, h } = setup();
    const { buyer, session } = await startCheckout(app, h);
    const payload = event('checkout.session.completed', paidObject(session));
    expect((await request(app).post('/api/webhooks/stripe').set('content-type', 'application/json').send(payload)).status).toBe(400);
    expect((await send(app, payload, 'whsec_someone_else')).status).toBe(400);
    expect((await buyer.get('/api/orders')).body.orders).toHaveLength(0);
  });

  it('marks the order paid once, even if Stripe delivers the event twice', async () => {
    const { app, h } = setup();
    const { buyer, session } = await startCheckout(app, h);
    const payload = event('checkout.session.completed', paidObject(session));
    expect((await send(app, payload)).status).toBe(200);
    expect((await send(app, payload)).status).toBe(200);
    const orders = (await buyer.get('/api/orders')).body.orders;
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({ status: 'paid', totalCents: session.totalCents, payment: { provider: 'stripe', demo: false } });
    expect((await buyer.get('/api/cart')).body.items ?? []).toHaveLength(0);
  });

  it('does not mark an unpaid or wrong-amount session as paid', async () => {
    const { app, h } = setup();
    const { buyer, session } = await startCheckout(app, h);
    await send(app, event('checkout.session.completed', paidObject(session, { payment_status: 'unpaid' }))).expect(200);
    const wrong = await send(app, event('checkout.session.completed', paidObject(session, { amount_total: 1 }), 'evt_2')).expect(200);
    expect(wrong.body.ignored).toBe(true);
    expect((await buyer.get('/api/orders')).body.orders).toHaveLength(0);
    expect((await buyer.get(`/api/checkout/sessions/${session.id}`)).body.session.status).toBe('pending');
  });

  it('ignores events for sessions it does not know', async () => {
    const { app } = setup();
    const res = await send(app, event('checkout.session.completed', { client_reference_id: 'nope', payment_status: 'paid', amount_total: 100, currency: 'usd' })).expect(200);
    expect(res.body.ignored).toBe(true);
  });

  it('closes the session when Stripe says it expired, and an expired one can never become an order', async () => {
    const { app, h } = setup();
    const { buyer, session } = await startCheckout(app, h);
    await send(app, event('checkout.session.expired', { client_reference_id: session.id })).expect(200);
    expect((await buyer.get(`/api/checkout/sessions/${session.id}`)).body.session).toMatchObject({ status: 'failed' });
    await send(app, event('checkout.session.completed', paidObject(session), 'evt_3')).expect(200);
    expect((await buyer.get('/api/orders')).body.orders).toHaveLength(0);
  });

  it('refunds a buyer who paid for something that sold out meanwhile', async () => {
    const { app, h, fake, commerce } = setup();
    const owner = await signIn(app, h, 's@example.com');
    await owner.post('/api/seller/activate').send({ storeName: 'Asha Crafts' }).expect(200);
    const category = (await request(app).get('/api/categories')).body.categories?.[0]?.slug ?? 'crafts';
    const created = await owner.post('/api/seller/products').send({ title: 'Mug', brand: 'Asha', category, price: 20, stockQty: 1, description: 'A mug.', features: ['x'], imageUrls: ['https://images.example.com/m.jpg'] }).expect(201);
    const id = created.body.product.id;
    const open = async (email) => {
      const b = await signIn(app, h, email);
      await b.put(`/api/cart/items/${id}`).send({ qty: 1 }).expect(200);
      return (await b.post('/api/checkout/sessions').send({ address }).expect(201)).body.session;
    };
    const first = await open('one@example.com');
    const second = await open('two@example.com');
    await send(app, event('checkout.session.completed', paidObject(first), 'evt_a')).expect(200);
    expect(fake.refunds.create).not.toHaveBeenCalled();
    await send(app, event('checkout.session.completed', paidObject(second, { payment_intent: 'pi_second' }), 'evt_b')).expect(200);
    expect(fake.refunds.create).toHaveBeenCalledTimes(1);
    expect(fake.refunds.create.mock.calls[0][0]).toEqual({ payment_intent: 'pi_second' });
    expect(await commerce.store.findSession(second.id)).toMatchObject({ status: 'failed' });
  });

  it('answers 500 so Stripe retries when our own processing fails', async () => {
    const { app, h, commerce } = setup();
    const { session } = await startCheckout(app, h);
    vi.spyOn(commerce.checkout, 'confirmExternalPayment').mockRejectedValueOnce(new Error('database down'));
    expect((await send(app, event('checkout.session.completed', paidObject(session)))).status).toBe(500);
  });
});
