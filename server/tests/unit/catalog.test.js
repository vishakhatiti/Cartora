import { describe, it, expect } from 'vitest';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { normalizeProduct, toCategory, isPlaceholderImage, reviewerName } from '../../src/services/catalog/normalize.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const catalog = createCatalog(rawFixture);
const ids = (result) => result.items.map((p) => p.id);

describe('normalize helpers', () => {
  it('builds category slugs and labels', () => {
    expect(toCategory('Arts_Crafts_and_Sewing')).toEqual({ slug: 'arts-crafts-and-sewing', label: 'Arts Crafts & Sewing' });
  });

  it('detects the dataset placeholder image', () => {
    expect(isPlaceholderImage('https://placeholder.com')).toBe(true);
    expect(isPlaceholderImage('')).toBe(true);
    expect(isPlaceholderImage('not a url')).toBe(true);
    expect(isPlaceholderImage('https://m.media-amazon.com/images/I/x.jpg')).toBe(false);
  });

  it('masks reviewer ids', () => {
    expect(reviewerName('A850301USER')).toBe('Customer 0301');
    expect(reviewerName(undefined)).toBe('Customer');
  });

  it('drops records without a usable price, id or title', () => {
    expect(normalizeProduct({ parent_asin: 'X', title: 'T', price: 'None' })).toBeNull();
    expect(normalizeProduct({ parent_asin: 'X', title: 'T', price: '0' })).toBeNull();
    expect(normalizeProduct({ parent_asin: '', title: 'T', price: '5' })).toBeNull();
    expect(normalizeProduct({ parent_asin: 'X', title: ' ', price: '5' })).toBeNull();
  });

  it('converts prices to integer cents and ignores a deal that is not cheaper', () => {
    const p = normalizeProduct(rawFixture[2]);
    expect(p.priceCents).toBe(12050);
    expect(p.deal).toBeNull();
    expect(p.finalPriceCents).toBe(12050);
  });

  it('uses a valid deal price', () => {
    const p = normalizeProduct(rawFixture[1]);
    expect(p.finalPriceCents).toBe(6000);
    expect(p.deal).toEqual({ percent: 25, salePriceCents: 6000 });
  });

  it('marks placeholder-only products as having no real image', () => {
    expect(normalizeProduct(rawFixture[0])).toMatchObject({ hasRealImage: false, images: [] });
    expect(normalizeProduct(rawFixture[1]).hasRealImage).toBe(true);
  });
});

describe('catalog loading', () => {
  it('skips bad and duplicate records and counts them', () => {
    expect(catalog.size).toBe(4);
    expect(catalog.skipped).toBe(3);
  });

  it('lists categories with counts', () => {
    expect(catalog.categories).toEqual([
      { slug: 'electronics', label: 'Electronics', count: 1 },
      { slug: 'home-and-kitchen', label: 'Home & Kitchen', count: 2 },
      { slug: 'toys-and-games', label: 'Toys & Games', count: 1 },
    ]);
  });
});

describe('search', () => {
  it('matches every word, case-insensitively, in title, brand or category', () => {
    expect(ids(catalog.search({ q: 'STEEL' })).sort()).toEqual(['A1', 'A2']);
    expect(ids(catalog.search({ q: 'steel knife' }))).toEqual(['A2']);
    expect(ids(catalog.search({ q: 'sharp' }))).toEqual(['A2']); // brand
    expect(ids(catalog.search({ q: 'electronics' }))).toEqual(['A3']); // category
  });

  it('returns an empty page, not an error, when nothing matches', () => {
    const r = catalog.search({ q: 'zzzz' });
    expect(r).toMatchObject({ items: [], total: 0, totalPages: 1, page: 1 });
  });

  it('ranks title matches ahead of weaker matches', () => {
    // Both titles contain "steel", but A2's title starts with it, which scores higher.
    expect(ids(catalog.search({ q: 'steel' }))).toEqual(['A2', 'A1']);
    // A brand-only match ranks below a title match: "acme" is only a brand, "headphones" a title word.
    expect(ids(catalog.search({ q: 'acme headphones' }))).toEqual(['A3']);
  });

  it('filters by category, brand, price (using the deal price), rating and deals', () => {
    expect(ids(catalog.search({ category: 'electronics' }))).toEqual(['A3']);
    expect(ids(catalog.search({ brands: ['acme'] })).sort()).toEqual(['A1', 'A3']);
    expect(ids(catalog.search({ maxPriceCents: 6000 })).sort()).toEqual(['A1', 'A2', 'A4']); // A2 sale = $60.00 included
    expect(ids(catalog.search({ minPriceCents: 6001 }))).toEqual(['A3']);
    expect(ids(catalog.search({ minRating: 4.5 })).sort()).toEqual(['A1', 'A3']);
    expect(ids(catalog.search({ dealsOnly: true }))).toEqual(['A2']);
  });

  it('sorts by price, rating and discount', () => {
    expect(ids(catalog.search({ sort: 'price_asc' }))).toEqual(['A4', 'A1', 'A2', 'A3']);
    expect(ids(catalog.search({ sort: 'price_desc' }))).toEqual(['A3', 'A2', 'A1', 'A4']);
    expect(ids(catalog.search({ sort: 'rating' }))).toEqual(['A3', 'A1', 'A4', 'A2']);
    expect(ids(catalog.search({ sort: 'discount' }))[0]).toBe('A2');
  });

  it('paginates and clamps out-of-range pages and sizes', () => {
    const p1 = catalog.search({ pageSize: 3, page: 1 });
    expect(p1).toMatchObject({ total: 4, totalPages: 2, items: expect.any(Array) });
    expect(p1.items).toHaveLength(3);
    expect(catalog.search({ pageSize: 3, page: 2 }).items).toHaveLength(1);
    expect(catalog.search({ pageSize: 3, page: 99 }).page).toBe(2);
    expect(catalog.search({ pageSize: 9999 }).pageSize).toBe(48);
  });

  it('never includes reviews or features in listing items', () => {
    const [item] = catalog.search({ q: 'bottle' }).items;
    expect(item).not.toHaveProperty('reviews');
    expect(item).not.toHaveProperty('features');
    expect(item.reviewCount).toBe(3);
    for (const internal of ['haystack', 'titleLower', 'titleWords']) expect(item).not.toHaveProperty(internal);
  });

  it('returns facet counts for the filtered result', () => {
    const { facets } = catalog.search({ q: 'steel' });
    expect(facets.categories).toEqual([{ slug: 'home-and-kitchen', count: 2 }]);
    expect(facets.brands.map((b) => b.name).sort()).toEqual(['Acme', 'Sharp Co']);
  });
});

describe('detail, reviews, related, suggestions', () => {
  it('returns detail with a rating breakdown computed from reviews', () => {
    const d = catalog.getDetail('A1');
    expect(d.ratingBreakdown).toEqual({ 1: 1, 2: 0, 3: 0, 4: 0, 5: 2 });
    expect(d.features).toEqual(['f1']);
    expect(d).not.toHaveProperty('reviews');
    expect(catalog.getDetail('nope')).toBeNull();
  });

  it('sorts and paginates reviews', () => {
    expect(catalog.getReviews('A1', { sort: 'recent' }).items.map((r) => r.rating)).toEqual([5, 5, 1]);
    expect(catalog.getReviews('A1', { sort: 'lowest' }).items[0].rating).toBe(1);
    const page = catalog.getReviews('A1', { pageSize: 2, page: 2 });
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(3);
    expect(catalog.getReviews('A2').items).toEqual([]);
    expect(catalog.getReviews('nope')).toBeNull();
  });

  it('finds related products in the same category, excluding itself', () => {
    expect(catalog.getRelated('A1').map((p) => p.id)).toEqual(['A2']);
    expect(catalog.getRelated('A4')).toEqual([]);
    expect(catalog.getRelated('nope')).toBeNull();
  });

  it('suggests products and categories', () => {
    const s = catalog.suggest('ste');
    expect(s.products.map((p) => p.id).sort()).toEqual(['A1', 'A2']);
    expect(catalog.suggest('elec').categories.map((c) => c.slug)).toEqual(['electronics']);
    expect(catalog.suggest('   ')).toEqual({ products: [], categories: [] });
  });
});

describe('stock images for products without their own photo', () => {
  const photo = (id) => ({ id, thumb: `t${id}`, large: `l${id}`, alt: 'a', photographer: 'Ann', photographerUrl: 'u', pageUrl: 'p' });
  const stockImages = { categories: { electronics: [photo(1), photo(2), photo(3)], 'home-and-kitchen': [photo(9)] } };
  const withStock = createCatalog(rawFixture, { stockImages });

  it('labels kinds honestly: real photo, stock photo, or none', () => {
    const byId = (id) => withStock.getDetail(id);
    expect(byId('A2').imageKind).toBe('real'); // has an Amazon image, so no stock photo is added
    expect(byId('A2').stockImage).toBeNull();
    expect(byId('A3').imageKind).toBe('stock');
    expect(byId('A3').hasRealImage).toBe(false); // a stock photo never counts as a real product photo
    expect(byId('A3').stockImage.credit).toEqual({ photographer: 'Ann', photographerUrl: 'u', pageUrl: 'p' });
    expect(byId('A4').imageKind).toBe('none'); // no photos for toys-and-games
  });

  it('is deterministic and included in listings', () => {
    const again = createCatalog(rawFixture, { stockImages });
    expect(again.getDetail('A3').stockImage).toEqual(withStock.getDetail('A3').stockImage);
    const [listed] = withStock.search({ category: 'electronics' }).items;
    expect(listed.stockImage.large).toMatch(/^l\d$/);
  });

  it('works without any stock image file', () => {
    expect(catalog.getDetail('A3').imageKind).toBe('none');
  });
});
