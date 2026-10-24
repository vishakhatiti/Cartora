import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';

// These tests need no database: the app is built from validated test settings.
const env = parseEnv({ NODE_ENV: 'test', FRONTEND_URL: 'http://localhost:5173' });
const app = createApp(env);

describe('health endpoints', () => {
  it('GET /api/health reports the process is up', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(typeof res.body.uptimeSeconds).toBe('number');
  });

  it('GET /api/health/ready returns 503 while the database is disconnected', async () => {
    const res = await request(app).get('/api/health/ready');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'unavailable', database: 'disconnected' });
  });
});

describe('error handling', () => {
  it('returns a JSON 404 for unknown routes', async () => {
    const res = await request(app).get('/api/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 400 for malformed JSON instead of crashing', async () => {
    const res = await request(app).post('/api/anything').set('Content-Type', 'application/json').send('{bad json');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('BAD_JSON');
  });

  it('rejects oversized request bodies', async () => {
    const big = JSON.stringify({ data: 'x'.repeat(200 * 1024) });
    const res = await request(app).post('/api/anything').set('Content-Type', 'application/json').send(big);
    expect(res.status).toBe(413);
  });
});

describe('security headers and CORS', () => {
  it('hides the framework header and sets security headers', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');
  });

  it('allows the configured client origin with credentials', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not grant CORS access to other origins', async () => {
    const res = await request(app).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });
});

describe('CORS', () => {
  const origin = 'https://shop-at-cartora.vercel.app';
  // The setting is typed with a trailing slash on purpose: that mistake must not block the real origin.
  const corsApp = createApp(parseEnv({ NODE_ENV: 'test', FRONTEND_URL: `${origin}/` }));

  it('allows the configured frontend origin with credentials', async () => {
    const res = await request(corsApp).get('/api/health').set('Origin', origin);
    expect(res.headers['access-control-allow-origin']).toBe(origin);
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  it('does not allow another origin', async () => {
    const res = await request(corsApp).get('/api/health').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBe(origin); // never echoes the caller's origin
  });
});
