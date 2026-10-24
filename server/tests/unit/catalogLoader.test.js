import { describe, it, expect } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadCatalogFile } from '../../src/services/catalog/catalog.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const dir = mkdtempSync(join(tmpdir(), 'cartora-loader-'));

describe('loadCatalogFile', () => {
  it('reads plain and gzip-compressed catalogs identically', () => {
    const json = JSON.stringify(rawFixture);
    writeFileSync(join(dir, 'c.json'), json);
    writeFileSync(join(dir, 'c.json.gz'), gzipSync(json));
    const plain = loadCatalogFile(join(dir, 'c.json'));
    const zipped = loadCatalogFile(join(dir, 'c.json.gz'));
    expect(zipped.size).toBe(4);
    expect(zipped.search({ sort: 'price_asc' }).items.map((p) => p.id))
      .toEqual(plain.search({ sort: 'price_asc' }).items.map((p) => p.id));
  });

  it('rejects a file that is not an array', () => {
    writeFileSync(join(dir, 'bad.json'), '{"products": []}');
    expect(() => loadCatalogFile(join(dir, 'bad.json'))).toThrow(/array/);
  });
});
