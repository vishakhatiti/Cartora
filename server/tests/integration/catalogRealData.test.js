import { describe, it, expect, beforeAll } from 'vitest';
import { loadCatalogFile, DATA_PATH } from '../../src/services/catalog/catalog.js';

// Sanity checks against the real server/data/data.json that ships with the repo.
describe('real dataset (server/data/data.json)', () => {
  let catalog;
  beforeAll(() => {
    catalog = loadCatalogFile(DATA_PATH); // pinned to the bundled file so adding catalogue.json.gz cannot change this test
  });

  it('loads all 12,500 products across 25 categories', () => {
    expect(catalog.size).toBe(12500);
    expect(catalog.skipped).toBe(0);
    expect(catalog.categories).toHaveLength(25);
  });

  it('every product has an integer-cent price and a final price no higher than the list price', () => {
    const all = catalog.search({ pageSize: 48 });
    expect(all.total).toBe(12500);
    for (let page = 1; page <= 20; page += 1) {
      for (const p of catalog.search({ page, pageSize: 48 }).items) {
        expect(Number.isInteger(p.priceCents)).toBe(true);
        expect(p.finalPriceCents).toBeLessThanOrEqual(p.priceCents);
      }
    }
  });

  it('flags the shared placeholder image so the UI draws generated artwork', () => {
    const [item] = catalog.search({ pageSize: 1 }).items;
    expect(item.hasRealImage).toBe(false);
    expect(item.images).toEqual([]);
  });

  it('searches quickly enough for interactive use', () => {
    const start = performance.now();
    for (let i = 0; i < 20; i += 1) catalog.search({ q: 'system', sort: 'rating' });
    expect((performance.now() - start) / 20).toBeLessThan(100); // ms per search, generous bound
  });
});
