import { apiFetch } from './api.js';

/** Build a query string, leaving out empty values so URLs stay short and cacheable. */
export function toQuery(params = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === '') continue;
    query.set(key, String(value));
  }
  return query.toString();
}

const withQuery = (path, params) => {
  const q = toQuery(params);
  return q ? `${path}?${q}` : path;
};

/** Read-only catalog endpoints. See "Catalog API" in README.md. */
export const catalogApi = {
  categories: (signal) => apiFetch('/categories', { signal }),
  products: (params, signal) => apiFetch(withQuery('/products', params), { signal }),
  product: (id, signal) => apiFetch(`/products/${encodeURIComponent(id)}`, { signal }),
  reviews: (id, params, signal) => apiFetch(withQuery(`/products/${encodeURIComponent(id)}/reviews`, params), { signal }),
  related: (id, signal) => apiFetch(`/products/${encodeURIComponent(id)}/related`, { signal }),
  discover: (kind, params, signal) => apiFetch(withQuery(`/discover/${encodeURIComponent(kind)}`, params), { signal }),
  suggestions: (q, signal) => apiFetch(withQuery('/search/suggestions', { q }), { signal }),
};
