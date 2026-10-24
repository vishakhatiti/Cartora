import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createHarness, SECRET } from '../helpers/authHarness.js';

const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', JWT_SECRET: SECRET });

function setup() {
  const h = createHarness();
  return { h, app: createApp(env, { authService: h.service }) };
}

async function signedInAgent(app, h, email = 'asha@example.com') {
  const agent = request.agent(app);
  await agent.post('/api/auth/register').send({ name: 'Asha', email, password: 'a-good-password' }).expect(202);
  await agent.post('/api/auth/verify-email').send({ email, code: h.lastCode() }).expect(200);
  return agent;
}

describe('seller activation', () => {
  it('rejects guests', async () => {
    const { app } = setup();
    await request(app).post('/api/seller/activate').send({ storeName: 'Asha Crafts' }).expect(401);
    await request(app).get('/api/seller/me').expect(401);
  });

  it('keeps ordinary customers out of seller-only routes', async () => {
    const { app, h } = setup();
    const agent = await signedInAgent(app, h);
    const res = await agent.get('/api/seller/me');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SELLER_REQUIRED');
  });

  it('turns the signed-in account into a seller, and /me and /auth/me both reflect it', async () => {
    const { app, h } = setup();
    const agent = await signedInAgent(app, h);
    const res = await agent.post('/api/seller/activate').send({ storeName: '  Asha Crafts & Co  ' });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ isSeller: true, storeName: 'Asha Crafts & Co', email: 'asha@example.com' });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    expect((await agent.get('/api/seller/me')).body.store.name).toBe('Asha Crafts & Co');
    expect((await agent.get('/api/auth/me')).body.user.isSeller).toBe(true);
  });

  it('is safe to repeat and does not rename an existing store', async () => {
    const { app, h } = setup();
    const agent = await signedInAgent(app, h);
    await agent.post('/api/seller/activate').send({ storeName: 'First Name' }).expect(200);
    const again = await agent.post('/api/seller/activate').send({ storeName: 'Second Name' });
    expect(again.status).toBe(200);
    expect(again.body.user.storeName).toBe('First Name');
  });

  it('validates the store name on the server', async () => {
    const { app, h } = setup();
    const agent = await signedInAgent(app, h);
    for (const storeName of ['', 'A', 'x'.repeat(61), '<script>alert(1)</script>', 123, undefined]) {
      const res = await agent.post('/api/seller/activate').send({ storeName });
      expect(res.status).toBe(400);
    }
    expect((await agent.get('/api/auth/me')).body.user.isSeller).toBe(false);
  });

  it('ignores a client-supplied isSeller flag', async () => {
    const { app, h } = setup();
    const agent = await signedInAgent(app, h);
    await agent.post('/api/auth/login').send({ email: 'asha@example.com', password: 'a-good-password', isSeller: true }).expect(200);
    expect((await agent.get('/api/auth/me')).body.user.isSeller).toBe(false);
    expect((await agent.get('/api/seller/me')).status).toBe(403);
  });

  it('does not let one account become a seller through another account', async () => {
    const { app, h } = setup();
    const asha = await signedInAgent(app, h, 'asha@example.com');
    const ravi = await signedInAgent(app, h, 'ravi@example.com');
    await asha.post('/api/seller/activate').send({ storeName: 'Asha Crafts' }).expect(200);
    expect((await ravi.get('/api/seller/me')).status).toBe(403);
  });
});
