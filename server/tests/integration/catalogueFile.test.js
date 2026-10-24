import { describe, it, expect, beforeAll } from 'vitest';
import { existsSync } from 'node:fs';
import { loadCatalogFile, GZ_PATH } from '../../src/services/catalog/catalog.js';

// Checks the committed server/data/catalogue.json.gz itself.
describe.skipIf(!existsSync(GZ_PATH))('committed catalogue.json.gz', () => {
  let catalog;
  beforeAll(() => {
    catalog = loadCatalogFile(GZ_PATH);
  });

  it('loads 12,000 products in 24 categories of 500 with nothing skipped', () => {
    expect(catalog.size).toBe(12000);
    expect(catalog.skipped).toBe(0);
    expect(catalog.categories).toHaveLength(24);
    expect(catalog.categories.every((c) => c.count === 500)).toBe(true);
  });

  it('gives every product a real Amazon-hosted photo', () => {
    let checked = 0;
    for (let page = 1; page <= 250; page += 1) {
      for (const p of catalog.search({ page, pageSize: 48 }).items) {
        expect(p.hasRealImage).toBe(true);
        expect(p.images[0].large).toMatch(/^https:\/\/m\.media-amazon\.com\//);
        expect(Number.isInteger(p.priceCents)).toBe(true);
        checked += 1;
      }
    }
    expect(checked).toBe(12000);
  });

  it('serves a product with reviews, details and a rating breakdown', () => {
    const [first] = catalog.search({ category: 'appliances', sort: 'rating' }).items;
    const detail = catalog.getDetail(first.id);
    expect(detail.ratingBreakdown).toBeTypeOf('object');
    expect(Object.keys(detail.details).length).toBeGreaterThan(0);
  });

  it('searches quickly', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) catalog.search({ q: 'water filter', sort: 'rating' });
    expect((performance.now() - start) / 20).toBeLessThan(100);
  });
});
