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
const valid = { name: 'Asha', email: 'Asha@Example.com', topic: 'order', orderNumber: 'crt-abcd2345', message: 'My parcel has not arrived yet.' };

function setup() {
  const h = createHarness();
  const commerce = createCommerce({ store: createMemoryCommerceStore(), getCatalog: () => catalog, provider: createDemoProvider() });
  return { h, app: createApp(env, { catalog, authService: h.service, commerce }) };
}
async function signIn(app, h, email) {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Asha', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}

describe('customer service tickets', () => {
  it('lets a guest send a request and returns a ticket number', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/support/tickets').send(valid);
    expect(res.status).toBe(201);
    expect(res.body.ticket).toMatchObject({ ticketNumber: expect.stringMatching(/^SUP-[A-Z0-9]{8}$/), topic: 'order', orderNumber: 'CRT-ABCD2345', status: 'open' });
    expect(JSON.stringify(res.body)).not.toMatch(/example\.com/); // the email is not echoed back
  });

  it('validates every field', async () => {
    const { app } = setup();
    for (const bad of [{ name: '' }, { email: 'nope' }, { topic: 'refund-me' }, { orderNumber: 'ORDER-1' }, { message: 'short' }, { message: 'x'.repeat(2001) }]) {
      expect((await request(app).post('/api/support/tickets').send({ ...valid, ...bad })).status, JSON.stringify(bad)).toBe(400);
    }
    expect((await request(app).post('/api/support/tickets').send({ ...valid, orderNumber: '' })).status).toBe(201);
  });

  it('uses the account email for signed-in users and lists only their own tickets', async () => {
    const { app, h } = setup();
    const one = await signIn(app, h, 'one@example.com');
    const two = await signIn(app, h, 'two@example.com');
    await one.post('/api/support/tickets').send({ ...valid, email: 'someone-else@example.com' }).expect(201);
    expect((await one.get('/api/support/tickets')).body.tickets).toHaveLength(1);
    expect((await two.get('/api/support/tickets')).body.tickets).toEqual([]);
    expect((await request(app).get('/api/support/tickets')).status).toBe(401);
  });

  it('rate limits repeated requests', async () => {
    const { app } = setup();
    let last;
    for (let i = 0; i < 11; i += 1) last = await request(app).post('/api/support/tickets').send(valid);
    expect(last.status).toBe(429);
  });
});
