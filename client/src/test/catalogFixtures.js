import { vi } from 'vitest';

export const categories = [
  { slug: 'electronics', label: 'Electronics', count: 500 },
  { slug: 'books', label: 'Books', count: 500 },
];

export const makeProduct = (over = {}) => ({
  id: 'B0TEST0001', title: 'Noise-cancelling Headphones', brand: 'Acme',
  category: { slug: 'electronics', label: 'Electronics' },
  priceCents: 5999, deal: null, finalPriceCents: 5999, ratingAvg: 4.5, ratingCount: 1200,
  images: [{ thumb: 'https://img.test/a-t.jpg', large: 'https://img.test/a.jpg' }, { thumb: 'https://img.test/b-t.jpg', large: 'https://img.test/b.jpg' }],
  hasRealImage: true, imageKind: 'real', reviewCount: 2, ...over,
});

export const detail = (over = {}) => ({
  ...makeProduct(), features: ['Fifty hour battery', 'Folds flat'], description: 'Comfortable over-ear headphones.',
  details: { Color: 'Black', Weight: '250 g' }, categoryPath: ['Electronics'],
  ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 }, ...over,
});

export const reviewsPage = {
  items: [
    { id: 0, reviewer: 'Customer 1234', rating: 5, title: 'Great sound', text: 'Love them.', createdAt: '2024-03-01T00:00:00.000Z', verifiedPurchase: true, helpfulCount: 3 },
    { id: 1, reviewer: 'Customer', rating: 4, title: '', text: 'Good value.', createdAt: null, verifiedPurchase: false, helpfulCount: 0 },
  ],
  page: 1, pageSize: 5, total: 2, totalPages: 1, breakdown: { 1: 0, 2: 0, 3: 0, 4: 1, 5: 1 },
};

const ok = (body) => Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(body) });
const fail = (status, code, message) => Promise.resolve({ ok: false, status, json: () => Promise.resolve({ error: { code, message } }) });

/**
 * Stub fetch with a tiny router for the catalog API. Returns the spy so tests can inspect the URLs called.
 * `overrides` maps a path prefix to a function (urlObject) => body | Promise.
 */
export function stubCatalogFetch(overrides = {}) {
  const defaults = {
    '/api/health/ready': () => ({}),
    '/api/categories': () => ({ categories }),
    '/api/search/suggestions': () => ({ products: [{ id: 'B0TEST0001', title: 'Noise-cancelling Headphones', category: 'Electronics' }], categories: [{ slug: 'electronics', label: 'Electronics', count: 500 }] }),
    '/api/products': () => ({ items: [makeProduct(), makeProduct({ id: 'B0TEST0002', title: 'Paperback Novel', brand: '', category: { slug: 'books', label: 'Books' }, finalPriceCents: 1299, priceCents: 1299, images: [], hasRealImage: false, imageKind: 'none' })], page: 1, pageSize: 24, total: 2, totalPages: 1, facets: { categories: [{ slug: 'electronics', count: 1 }, { slug: 'books', count: 1 }], brands: [{ name: 'Acme', count: 1 }] } }),
  };
  const routes = { ...defaults, ...overrides };
  const spy = vi.fn((input) => {
    const url = new URL(String(input), 'http://localhost');
    // Longest prefix wins so /api/products/ID/reviews beats /api/products.
    const match = Object.keys(routes).filter((p) => url.pathname === p || url.pathname.startsWith(`${p}/`)).sort((a, b) => b.length - a.length)[0];
    if (!match) return fail(404, 'NOT_FOUND', 'Not found');
    const out = routes[match](url);
    if (out && out.__error) return fail(out.status, out.code, out.message);
    return ok(out);
  });
  vi.stubGlobal('fetch', spy);
  return spy;
}

export const apiError = (status, code, message) => ({ __error: true, status, code, message });
