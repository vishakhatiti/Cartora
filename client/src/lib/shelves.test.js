import { describe, it, expect } from 'vitest';
import { pickFeatured } from './shelves.js';

const p = (id, label, images = [{ thumb: 'x' }]) => ({ id, category: { label }, images });

describe('pickFeatured', () => {
  it('prefers photogenic categories, one each, keeping best-seller order inside a category', () => {
    const items = [p('gift', 'Video Games'), p('bed', 'Home & Kitchen'), p('toy1', 'Toys & Games'), p('nail', 'Beauty & Personal Care'), p('toy2', 'Toys & Games'), p('cam', 'Electronics')];
    expect(pickFeatured(items).map((x) => x.id)).toEqual(['nail', 'toy1', 'cam']);
  });
  it('skips products without photos and falls back to the ranking when needed', () => {
    expect(pickFeatured([p('a', 'Video Games'), p('b', 'Grocery & Gourmet Food'), p('c', 'Beauty & Personal Care', [])]).map((x) => x.id)).toEqual(['a', 'b', 'c']);
    expect(pickFeatured([])).toEqual([]);
  });
});
