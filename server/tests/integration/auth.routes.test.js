import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createHarness, SECRET } from '../helpers/authHarness.js';

const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173', JWT_SECRET: SECRET });

function setup(envOverrides = {}) {
  const h = createHarness();
  const app = createApp({ ...env, ...envOverrides }, { authService: h.service });
  return { h, app };
}

async function signUp(app, h, agent = request.agent(app)) {
  await agent.post('/api/auth/register').send({ name: 'Asha', email: 'Asha@Example.com ', password: 'a-good-password' }).expect(202);
  const res = await agent.post('/api/auth/verify-email').send({ email: 'asha@example.com', code: h.lastCode() });
  return { agent, res };
}

describe('register and verify over HTTP', () => {
  it('normalises the email, answers 202, then verification sets a safe session cookie', async () => {
    const { h, app } = setup();
    const { agent, res } = await signUp(app, h);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'asha@example.com', name: 'Asha', emailVerified: true, isSeller: false });
    expect(res.body.user).not.toHaveProperty('passwordHash');
    const cookie = res.headers['set-cookie'][0];
    expect(cookie).toMatch(/^cartora_session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).not.toMatch(/Secure/); // test env only; production sets Secure (see below)
    const me = await agent.get('/api/auth/me');
    expect(me.status).toBe(200);
    expect(me.body.user.email).toBe('asha@example.com');
  });

  it('marks the cookie Secure in production', async () => {
    const { h, app } = setup({ NODE_ENV: 'production' });
    const { res } = await signUp(app, h);
    expect(res.headers['set-cookie'][0]).toMatch(/Secure/);
  });

  it('answers identically for a new and an already registered email', async () => {
    const { h, app } = setup();
    await signUp(app, h);
    const again = await request(app).post('/api/auth/register').send({ name: 'X', email: 'asha@example.com', password: 'another-password' });
    const fresh = await request(app).post('/api/auth/register').send({ name: 'Y', email: 'new@example.com', password: 'another-password' });
    expect(again.status).toBe(202);
    expect(again.body).toEqual(fresh.body);
  });
});

describe('input validation', () => {
  it.each([
    ['/api/auth/register', { name: '', email: 'a@x.com', password: 'longenough1' }],
    ['/api/auth/register', { name: 'A', email: 'not-an-email', password: 'longenough1' }],
    ['/api/auth/register', { name: 'A', email: 'a@x.com', password: 'short' }],
    ['/api/auth/register', { name: 'A', email: 'a@x.com', password: 'x'.repeat(129) }],
    ['/api/auth/register', { name: 'A', email: 'a@x.com', password: { $ne: 1 } }],
    ['/api/auth/login', { email: { $gt: '' }, password: 'longenough1' }],
    ['/api/auth/verify-email', { email: 'a@x.com', code: '12345' }],
    ['/api/auth/verify-email', { email: 'a@x.com', code: 'abcdef' }],
    ['/api/auth/reset', { email: 'a@x.com', code: '123456', newPassword: 'short' }],
    ['/api/auth/forgot', {}],
  ])('rejects bad input on %s with 400', async (path, body) => {
    const { app } = setup();
    const res = await request(app).post(path).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('rejects a non-JSON body', async () => {
    const { app } = setup();
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'text/plain').send('email=a@x.com');
    expect(res.status).toBe(400);
  });
});

describe('password login', () => {
  it('logs in with the right password, returns 401 for a wrong one, 403 when unverified', async () => {
    const { h, app } = setup();
    await request(app).post('/api/auth/register').send({ name: 'Asha', email: 'asha@example.com', password: 'a-good-password' });
    const unverified = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'a-good-password' });
    expect(unverified.status).toBe(403);
    expect(unverified.body.error.code).toBe('EMAIL_NOT_VERIFIED');
    await request(app).post('/api/auth/verify-email').send({ email: 'asha@example.com', code: h.lastCode() });
    const bad = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'nope-nope-nope' });
    expect(bad.status).toBe(401);
    expect(bad.headers['set-cookie']).toBeUndefined();
    const ok = await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'a-good-password' });
    expect(ok.status).toBe(200);
    expect(ok.headers['set-cookie'][0]).toMatch(/cartora_session=/);
  });
});

describe('login by code, forgot password, logout', () => {
  it('completes login by emailed code', async () => {
    const { h, app } = setup();
    await signUp(app, h);
    h.advance(61);
    await request(app).post('/api/auth/login-code/request').send({ email: 'asha@example.com' }).expect(202);
    const res = await request(app).post('/api/auth/login-code/verify').send({ email: 'asha@example.com', code: h.lastCode() });
    expect(res.status).toBe(200);
  });

  it('resets the password and signs out the old session', async () => {
    const { h, app } = setup();
    const { agent } = await signUp(app, h);
    h.advance(61);
    await request(app).post('/api/auth/forgot').send({ email: 'asha@example.com' }).expect(202);
    await request(app).post('/api/auth/reset').send({ email: 'asha@example.com', code: h.lastCode(), newPassword: 'a-brand-new-password' }).expect(200);
    expect((await agent.get('/api/auth/me')).status).toBe(401); // the cookie from before the reset is dead
    await request(app).post('/api/auth/login').send({ email: 'asha@example.com', password: 'a-brand-new-password' }).expect(200);
  });

  it('logout clears the cookie', async () => {
    const { h, app } = setup();
    const { agent } = await signUp(app, h);
    const res = await agent.post('/api/auth/logout');
    expect(res.status).toBe(204);
    expect(res.headers['set-cookie'][0]).toMatch(/cartora_session=;/);
    expect((await agent.get('/api/auth/me')).status).toBe(401);
  });
});

describe('sessions', () => {
  it('returns 401 without a cookie, with a garbage cookie, and with a token signed by another secret', async () => {
    const { app } = setup();
    expect((await request(app).get('/api/auth/me')).status).toBe(401);
    expect((await request(app).get('/api/auth/me').set('Cookie', 'cartora_session=garbage')).status).toBe(401);
    const { signSession } = await import('../../src/services/auth/tokens.js');
    const forged = signSession('another-secret-that-is-long-enough-123456', { id: 'u1', tokenVersion: 0 });
    expect((await request(app).get('/api/auth/me').set('Cookie', `cartora_session=${forged}`)).status).toBe(401);
  });

  it('does not cache /me', async () => {
    const { h, app } = setup();
    const { agent } = await signUp(app, h);
    expect((await agent.get('/api/auth/me')).headers['cache-control']).toBe('no-store');
  });
});

describe('server configuration', () => {
  it('answers 503 on auth routes when JWT_SECRET is missing, while the rest of the API still works', async () => {
    const noSecret = parseEnv({ NODE_ENV: 'test' });
    const app = createApp(noSecret);
    const res = await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'whatever12' });
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('AUTH_NOT_CONFIGURED');
    expect((await request(app).get('/api/health')).status).toBe(200);
  });
});

describe('brute-force limits', () => {
  it('stops repeated credential guesses from one IP with 429', async () => {
    const { app } = setup();
    let last;
    for (let i = 0; i < 25; i += 1) {
      last = await request(app).post('/api/auth/login').send({ email: 'a@x.com', password: 'wrong-password' });
    }
    expect(last.status).toBe(429);
    expect(last.body.error.code).toBe('RATE_LIMITED');
  });
});

describe('Google sign-in over HTTP', () => {
  const googleProfile = { sub: 'g-1', email: 'g@example.com', emailVerified: true, name: 'Gita', picture: null };

  it('signs in with a valid credential and sets the session cookie', async () => {
    const h = createHarness({ googleVerifier: { verify: async () => googleProfile } });
    const app = createApp(env, { authService: h.service });
    const res = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(40) });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: 'g@example.com', emailVerified: true });
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
  });

  it('rejects a missing or oversized credential with 400', async () => {
    const h = createHarness({ googleVerifier: { verify: async () => googleProfile } });
    const app = createApp(env, { authService: h.service });
    expect((await request(app).post('/api/auth/google').send({})).status).toBe(400);
    expect((await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(5001) })).status).toBe(400);
    expect((await request(app).post('/api/auth/google').send({ credential: { $ne: 1 } })).status).toBe(400);
  });

  it('returns 401 and no cookie when Google rejects the token', async () => {
    const { AppError } = await import('../../src/utils/AppError.js');
    const h = createHarness({ googleVerifier: { verify: async () => { throw new AppError(401, 'Google sign-in failed. Please try again.', 'GOOGLE_INVALID'); } } });
    const app = createApp(env, { authService: h.service });
    const res = await request(app).post('/api/auth/google').send({ credential: 'x'.repeat(40) });
    expect(res.status).toBe(401);
    expect(res.headers['set-cookie']).toBeUndefined();
  });
});
