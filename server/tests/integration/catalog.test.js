import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { parseEnv } from '../../src/config/env.js';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const env = parseEnv({ NODE_ENV: 'test', CLIENT_URL: 'http://localhost:5173' });
const app = createApp(env, { catalog: createCatalog(rawFixture) });

describe('GET /api/products', () => {
  it('searches, filters and sorts through query parameters (prices in dollars)', async () => {
    const res = await request(app).get('/api/products?q=steel&maxPrice=50&sort=price_asc');
    expect(res.status).toBe(200);
    expect(res.body.items.map((p) => p.id)).toEqual(['A1']);
    expect(res.body.total).toBe(1);
    expect(res.headers['cache-control']).toContain('max-age');
  });

  it('accepts repeated and comma-separated brand filters', async () => {
    const a = await request(app).get('/api/products?brand=Acme&brand=Blocko');
    const b = await request(app).get('/api/products?brand=Acme,Blocko');
    expect(a.body.items.map((p) => p.id).sort()).toEqual(['A1', 'A3', 'A4']);
    expect(b.body.total).toBe(3);
  });

  it('filters deals', async () => {
    const res = await request(app).get('/api/products?deals=true');
    expect(res.body.items.map((p) => p.id)).toEqual(['A2']);
  });

  it.each([
    ['sort=banana'],
    ['page=0'],
    ['pageSize=1000'],
    ['minRating=9'],
    ['minPrice=abc'],
    ['minPrice=100&maxPrice=10'],
    [`q=${'a'.repeat(101)}`],
  ])('rejects invalid query "%s" with 400', async (qs) => {
    const res = await request(app).get(`/api/products?${qs}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('treats regex and NoSQL-looking input as plain text', async () => {
    const res = await request(app).get('/api/products').query({ q: '.*[(', category: '{"$ne":1}' });
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(0);
  });
});

describe('GET /api/products/:id', () => {
  it('returns detail without raw reviews and with the generated-artwork flag', async () => {
    const res = await request(app).get('/api/products/A1');
    expect(res.status).toBe(200);
    expect(res.body.product).toMatchObject({ id: 'A1', hasRealImage: false, finalPriceCents: 4999 });
    expect(res.body.product).not.toHaveProperty('reviews');
    expect(res.body.product.ratingBreakdown[5]).toBe(2);
  });

  it('returns 404 for unknown or malformed ids', async () => {
    expect((await request(app).get('/api/products/ZZZ')).status).toBe(404);
    expect((await request(app).get('/api/products/bad%20id!')).status).toBe(404);
    expect((await request(app).get('/api/products/ZZZ/reviews')).status).toBe(404);
    expect((await request(app).get('/api/products/ZZZ/related')).status).toBe(404);
  });
});

describe('reviews, related, categories, suggestions', () => {
  it('lists reviews with a breakdown and pagination', async () => {
    const res = await request(app).get('/api/products/A1/reviews?pageSize=2&sort=highest');
    expect(res.status).toBe(200);
    expect(res.body.items).toHaveLength(2);
    expect(res.body.total).toBe(3);
    expect(res.body.items[0].reviewer).toMatch(/^Customer/);
    expect(res.body.items[0]).not.toHaveProperty('user_id');
  });

  it('rejects a bad review sort', async () => {
    expect((await request(app).get('/api/products/A1/reviews?sort=x')).status).toBe(400);
  });

  it('returns related products', async () => {
    const res = await request(app).get('/api/products/A1/related');
    expect(res.body.items.map((p) => p.id)).toEqual(['A2']);
  });

  it('returns categories and suggestions', async () => {
    expect((await request(app).get('/api/categories')).body.categories).toHaveLength(3);
    const s = await request(app).get('/api/search/suggestions?q=head');
    expect(s.body.products.map((p) => p.id)).toEqual(['A3']);
    expect((await request(app).get('/api/search/suggestions')).body.products).toEqual([]);
  });
});
