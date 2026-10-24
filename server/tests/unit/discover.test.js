import { describe, it, expect } from 'vitest';
import { createCatalog } from '../../src/services/catalog/catalog.js';

const review = (createdAt, rating = 5) => ({ rating, title: 't', text: 'x', timestamp: Math.floor(Date.parse(createdAt) / 1000), user_id: 'U1' });
const raw = (id, over = {}) => ({
  parent_asin: id, title: `Product ${id}`, price: '10.00', main_category: 'Electronics', store: 'Acme',
  average_rating: 4.5, rating_number: 100, reviews: [], ...over,
});
// Newest review in the data is 2023-06-01, so "recent" means 2022-06-01 onward.
const catalog = createCatalog([
  raw('OLDLOVED', { rating_number: 9000, reviews: [review('2019-01-01')] }),
  raw('HOTNOW', { rating_number: 50, reviews: [review('2023-05-01'), review('2023-06-01'), review('2023-04-01')] }),
  raw('NEWISH', { rating_number: 10, average_rating: 3.2, reviews: [review('2023-05-20')] }),
  raw('NOREVIEWS', { rating_number: 500 }),
]);
const ids = (r) => r.items.map((p) => p.id);

describe('discovery shelves', () => {
  it('ranks trending by reviews in the latest 12 months and drops products with none', () => {
    const r = catalog.discover('trending');
    expect(ids(r)).toEqual(['HOTNOW', 'NEWISH']);
    expect(r.basis).toMatch(/12 months/);
  });

  it('ranks best sellers by rating count, 4 stars and up, and says sales are unknown', () => {
    const r = catalog.discover('best-sellers');
    expect(ids(r)).toEqual(['OLDLOVED', 'NOREVIEWS', 'HOTNOW']);
    expect(r.basis).toMatch(/Sales figures are not available/);
  });

  it('ranks new releases by first review date, newest first', () => {
    expect(ids(catalog.discover('new-releases'))).toEqual(['NEWISH', 'HOTNOW', 'OLDLOVED']);
  });

  it('filters by category, paginates and rejects unknown shelves', () => {
    expect(catalog.discover('trending', { category: 'nope' }).items).toEqual([]);
    const page = catalog.discover('best-sellers', { pageSize: 2, page: 2 });
    expect(page).toMatchObject({ page: 2, totalPages: 2, total: 3 });
    expect(catalog.discover('bogus')).toBeNull();
  });

  it('never uses the generated best-seller flag', () => {
    const c = createCatalog([raw('A', { rating_number: 1, isBestSeller: true }), raw('B', { rating_number: 5 })]);
    expect(ids(c.discover('best-sellers'))).toEqual(['B', 'A']);
  });
});

describe('seller listings in the catalogue', () => {
  const listing = (id, over = {}) => ({
    parent_asin: id, title: `Listing ${id}`, price_cents: 1500, category: { slug: 'crafts', label: 'Crafts' }, brand: 'Asha Crafts',
    images: [{ thumb: 'https://img.test/a.jpg', large: 'https://img.test/a.jpg' }], seller_id: 'seller-1', store_name: 'Asha Crafts',
    stock_qty: 3, listed_at: '2026-10-01T00:00:00.000Z', ...over,
  });

  it('adds a listing to search, categories and new releases, and removes it again', () => {
    const c = createCatalog([raw('A')]);
    expect(c.hasCategory('crafts')).toBe(false);
    c.upsert(listing('S1'));
    expect(c.hasCategory('crafts')).toBe(true);
    expect(c.categories.find((x) => x.slug === 'crafts').count).toBe(1);
    expect(c.size).toBe(2);
    expect(c.getById('S1')).toMatchObject({ sellerId: 'seller-1', storeName: 'Asha Crafts', stockQty: 3 });
    expect(c.search({ q: 'listing' }).items.map((p) => p.id)).toEqual(['S1']);
    expect(c.discover('new-releases').items[0].id).toBe('S1');
    expect(c.remove('S1')).toBe(true);
    expect(c.hasCategory('crafts')).toBe(false);
    expect(c.search({ q: 'listing' }).items).toEqual([]);
    expect(c.remove('S1')).toBe(false);
  });

  it('replaces a listing in place when it is edited', () => {
    const c = createCatalog([]);
    c.upsert(listing('S2'));
    c.upsert(listing('S2', { price_cents: 2500, title: 'Renamed' }));
    expect(c.size).toBe(1);
    expect(c.getById('S2')).toMatchObject({ finalPriceCents: 2500, title: 'Renamed' });
  });

  it('never treats dataset products as seller-tracked stock', () => {
    const c = createCatalog([raw('A', { stock: 99 })]);
    expect(c.getById('A').stockQty).toBeNull();
    expect(c.getById('A').sellerId).toBeNull();
  });
});
