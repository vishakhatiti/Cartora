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
const home = { name: 'Asha Kulkarni', line1: '12 Garden Road', city: 'Pune', state: 'MH', postalCode: '411001', country: 'in' };
const work = { ...home, line1: '5 Office Park', line2: 'Floor 3', postalCode: '411014' };

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

describe('address book', () => {
  it('requires sign-in', async () => {
    const { app } = setup();
    for (const [m, p] of [['get', '/api/addresses'], ['post', '/api/addresses'], ['put', '/api/addresses/x'], ['post', '/api/addresses/x/default'], ['delete', '/api/addresses/x']]) {
      expect((await request(app)[m](p).send({})).status, `${m} ${p}`).toBe(401);
    }
  });

  it('makes the first address the default and normalises the country', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h, 'a@example.com');
    const res = await agent.post('/api/addresses').send({ address: home }).expect(201);
    expect(res.body.addresses).toEqual([expect.objectContaining({ line1: '12 Garden Road', country: 'IN', isDefault: true, id: expect.any(String) })]);
  });

  it('changes the default, edits and deletes, promoting a new default', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h, 'b@example.com');
    const first = (await agent.post('/api/addresses').send({ address: home })).body.addresses[0];
    const second = (await agent.post('/api/addresses').send({ address: work })).body.addresses.find((a) => a.id !== first.id);
    expect(second.isDefault).toBe(false);
    const switched = (await agent.post(`/api/addresses/${second.id}/default`).expect(200)).body.addresses;
    expect(switched.filter((a) => a.isDefault).map((a) => a.id)).toEqual([second.id]);
    const edited = (await agent.put(`/api/addresses/${second.id}`).send({ address: { ...work, city: 'Mumbai' } }).expect(200)).body.addresses.find((a) => a.id === second.id);
    expect(edited).toMatchObject({ city: 'Mumbai', isDefault: true });
    const afterDelete = (await agent.delete(`/api/addresses/${second.id}`).expect(200)).body.addresses;
    expect(afterDelete).toEqual([expect.objectContaining({ id: first.id, isDefault: true })]);
  });

  it('validates input and enforces the limit', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h, 'c@example.com');
    expect((await agent.post('/api/addresses').send({ address: { ...home, postalCode: '!!' } })).status).toBe(400);
    expect((await agent.post('/api/addresses').send({ address: { ...home, country: 'USA' } })).status).toBe(400);
    expect((await agent.post('/api/addresses').send({})).status).toBe(400);
    for (let i = 0; i < 10; i += 1) await agent.post('/api/addresses').send({ address: home }).expect(201);
    expect((await agent.post('/api/addresses').send({ address: home })).status).toBe(409);
  });

  it('keeps addresses private to their owner', async () => {
    const { app, h } = setup();
    const one = await signIn(app, h, 'one@example.com');
    const two = await signIn(app, h, 'two@example.com');
    const id = (await one.post('/api/addresses').send({ address: home })).body.addresses[0].id;
    expect((await two.get('/api/addresses')).body.addresses).toEqual([]);
    expect((await two.delete(`/api/addresses/${id}`)).status).toBe(404);
    expect((await two.put(`/api/addresses/${id}`).send({ address: work })).status).toBe(404);
    expect((await two.post(`/api/addresses/${id}/default`)).status).toBe(404);
    expect((await one.get('/api/addresses')).body.addresses).toHaveLength(1);
  });
});
