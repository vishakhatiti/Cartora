import { describe, it, expect } from 'vitest';
import { adaptCatalogueV2, isCatalogueV2 } from '../../src/services/catalog/formats.js';
import { createCatalog } from '../../src/services/catalog/catalog.js';

const img = (n) => ({ thumb: `https://m.media-amazon.com/t${n}.jpg`, large: `https://m.media-amazon.com/l${n}.jpg`, hiRes: `https://m.media-amazon.com/h${n}.jpg` });
const file = {
  source: 'test',
  categories: [{ slug: 'arts-crafts', name: 'Arts, Crafts & Sewing' }, { slug: 'books', name: 'Books' }],
  products: [
    { asin: 'P1', categorySlug: 'arts-crafts', title: 'Paint Set', brand: 'Brush Co', categoryPath: ['Arts', 'Paint'],
      priceCents: 1299, listPriceCents: 1599, averageRating: 4.6, ratingCount: 321, stock: 42, isBestSeller: true, importedRank: 9,
      features: ['Twelve colours'], description: 'A set of paints.', details: { Color: 'Multi', Bad: 5 }, images: [img(1), img(2)] },
    { asin: 'P2', categorySlug: 'books', title: 'A Novel', brand: '', categoryPath: [], priceCents: 899, listPriceCents: null,
      averageRating: 3.9, ratingCount: 12, stock: 3, isBestSeller: false, features: [], description: '', details: {}, images: [img(3)] },
    { asin: 'P3', categorySlug: 'books', title: 'Free thing', priceCents: 0, averageRating: 4, ratingCount: 1, images: [img(4)] },
  ],
  reviews: [
    { asin: 'P1', rating: 5, title: 'Great', body: 'Love them', verified: true, helpfulCount: 3, createdAt: '2020-01-02T03:04:05.000Z' },
    { asin: 'P1', rating: 2, title: 'Meh', body: 'Dried out', verified: false, helpfulCount: 0, createdAt: '2021-01-02T03:04:05.000Z' },
    { asin: 'GHOST', rating: 5, title: 'x', body: 'orphan review', verified: true, helpfulCount: 0, createdAt: '2021-01-02T03:04:05.000Z' },
  ],
};
const catalog = createCatalog(adaptCatalogueV2(file));

describe('catalogue.json.gz layout', () => {
  it('is detected, and a plain array is not', () => {
    expect(isCatalogueV2(file)).toBe(true);
    expect(isCatalogueV2([])).toBe(false);
    expect(isCatalogueV2({ items: [] })).toBe(false);
  });

  it('keeps the file\'s own category names and slugs', () => {
    expect(catalog.categories).toEqual([
      { slug: 'arts-crafts', label: 'Arts, Crafts & Sewing', count: 1 },
      { slug: 'books', label: 'Books', count: 1 },
    ]);
  });

  it('uses integer cents directly, skips zero-price products and uses the hi-res image', () => {
    expect(catalog.size).toBe(2);
    const p = catalog.getDetail('P1');
    expect(p.priceCents).toBe(1299);
    expect(p.images[0].large).toBe('https://m.media-amazon.com/h1.jpg');
    expect(p.hasRealImage).toBe(true);
    expect(p.imageKind).toBe('real');
  });

  it('does not expose generated stock, best-seller, rank or list-price values, nor invent a deal', () => {
    const p = catalog.getDetail('P1');
    for (const key of ['stock', 'isBestSeller', 'importedRank', 'listPriceCents']) expect(p).not.toHaveProperty(key);
    expect(p.deal).toBeNull();
    expect(p.finalPriceCents).toBe(1299);
  });

  it('exposes description, string-only details and category path on detail but not in listings', () => {
    const p = catalog.getDetail('P1');
    expect(p.description).toBe('A set of paints.');
    expect(p.details).toEqual({ Color: 'Multi' });
    expect(p.categoryPath).toEqual(['Arts', 'Paint']);
    const [listed] = catalog.search({ q: 'paint' }).items;
    for (const key of ['description', 'details', 'categoryPath', 'features']) expect(listed).not.toHaveProperty(key);
  });

  it('attaches reviews by asin with verified and helpful counts, and ignores orphan reviews', () => {
    const r = catalog.getReviews('P1', { sort: 'highest' });
    expect(r.total).toBe(2);
    expect(r.items[0]).toMatchObject({ rating: 5, reviewer: 'Customer', verifiedPurchase: true, helpfulCount: 3, text: 'Love them' });
    expect(r.items[0].createdAt).toBe('2020-01-02T03:04:05.000Z');
    expect(catalog.getReviews('P2').items).toEqual([]);
  });
});
