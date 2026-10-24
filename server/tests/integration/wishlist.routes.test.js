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

describe('wishlist', () => {
  it('requires sign-in', async () => {
    const { app } = setup();
    for (const [m, p] of [['get', '/api/wishlist'], ['put', '/api/wishlist/items/A1'], ['delete', '/api/wishlist/items/A1']]) {
      expect((await request(app)[m](p)).status, `${m} ${p}`).toBe(401);
    }
  });

  it('adds, lists newest first, ignores repeats and removes', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h, 'a@example.com');
    expect((await agent.get('/api/wishlist')).body.wishlist).toEqual({ items: [], ids: [], count: 0 });
    await agent.put('/api/wishlist/items/A1').expect(200);
    await agent.put('/api/wishlist/items/A4').expect(200);
    const again = await agent.put('/api/wishlist/items/A4').expect(200);
    expect(again.body.wishlist.ids).toEqual(['A4', 'A1']);
    expect(again.body.wishlist.items[0]).toMatchObject({ id: 'A4', title: expect.any(String), finalPriceCents: expect.any(Number) });
    const removed = await agent.delete('/api/wishlist/items/A4').expect(200);
    expect(removed.body.wishlist.ids).toEqual(['A1']);
    expect((await agent.delete('/api/wishlist/items/A4')).status).toBe(200); // removing what is not there is fine
  });

  it('rejects unknown products and malformed ids', async () => {
    const { app, h } = setup();
    const agent = await signIn(app, h, 'b@example.com');
    expect((await agent.put('/api/wishlist/items/NOPE')).status).toBe(404);
    expect((await agent.put('/api/wishlist/items/bad%20id!')).status).toBe(400);
  });

  it('keeps each user\'s wishlist private', async () => {
    const { app, h } = setup();
    const one = await signIn(app, h, 'one@example.com');
    const two = await signIn(app, h, 'two@example.com');
    await one.put('/api/wishlist/items/A1').expect(200);
    expect((await two.get('/api/wishlist')).body.wishlist.count).toBe(0);
  });
});
