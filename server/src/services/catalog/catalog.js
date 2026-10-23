import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { normalizeProduct, toSummary } from './normalize.js';

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;
export const SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'discount'];
export const REVIEW_SORTS = ['recent', 'highest', 'lowest'];

const DATA_PATH = fileURLToPath(new URL('../../../data/data.json', import.meta.url));

const tokenize = (text) => String(text ?? '').toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

function relevanceScore(product, tokens) {
  let score = 0;
  for (const token of tokens) {
    if (product.titleWords.includes(token)) score += 3;
    else if (product.titleWords.some((w) => w.startsWith(token))) score += 2;
    else score += 1; // matched only via brand or category
  }
  if (product.titleLower.startsWith(tokens[0])) score += 2;
  return score;
}

function countBy(items, keyFn) {
  const counts = new Map();
  for (const item of items) {
    const key = keyFn(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

/**
 * Read-only, in-memory catalog built from the dataset records.
 * The JSON file stays the source of truth; nothing here is written to MongoDB.
 */
export function createCatalog(rawProducts) {
  const products = [];
  const byId = new Map();
  let skipped = 0;

  for (const raw of rawProducts) {
    const product = normalizeProduct(raw);
    if (!product || byId.has(product.id)) {
      skipped += 1;
      continue;
    }
    const indexed = {
      ...product,
      titleLower: product.title.toLowerCase(),
      titleWords: tokenize(product.title),
      // Everything a shopper can search on, built once.
      haystack: `${product.title} ${product.brand} ${product.category.label}`.toLowerCase(),
    };
    products.push(indexed);
    byId.set(indexed.id, indexed);
  }

  const categories = [...countBy(products, (p) => p.category.slug)].map(([slug, count]) => ({
    slug,
    label: products.find((p) => p.category.slug === slug).category.label,
    count,
  })).sort((a, b) => a.label.localeCompare(b.label));
  const categorySlugs = new Set(categories.map((c) => c.slug));

  function search({
    q = '', category, brands = [], minPriceCents, maxPriceCents, minRating, dealsOnly = false,
    sort = 'relevance', page = 1, pageSize = DEFAULT_PAGE_SIZE,
  } = {}) {
    const tokens = tokenize(q);
    const brandSet = new Set(brands.map((b) => b.toLowerCase()));
    const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);

    let matches = products.filter((p) => {
      if (category && p.category.slug !== category) return false;
      if (brandSet.size && !brandSet.has(p.brand.toLowerCase())) return false;
      if (minPriceCents != null && p.finalPriceCents < minPriceCents) return false;
      if (maxPriceCents != null && p.finalPriceCents > maxPriceCents) return false;
      if (minRating != null && p.ratingAvg < minRating) return false;
      if (dealsOnly && !p.deal) return false;
      return tokens.every((t) => p.haystack.includes(t));
    });

    // Facet counts describe the filtered result so the sidebar matches what is on screen.
    const facets = {
      categories: [...countBy(matches, (p) => p.category.slug)].map(([slug, count]) => ({ slug, count })),
      brands: [...countBy(matches, (p) => p.brand)]
        .filter(([name]) => name)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    };

    const tieBreak = (a, b) => a.id.localeCompare(b.id); // stable, deterministic order
    const sorters = {
      relevance: tokens.length
        ? (a, b) => relevanceScore(b, tokens) - relevanceScore(a, tokens) || b.ratingCount - a.ratingCount || tieBreak(a, b)
        : (a, b) => b.ratingCount - a.ratingCount || tieBreak(a, b),
      price_asc: (a, b) => a.finalPriceCents - b.finalPriceCents || tieBreak(a, b),
      price_desc: (a, b) => b.finalPriceCents - a.finalPriceCents || tieBreak(a, b),
      rating: (a, b) => b.ratingAvg - a.ratingAvg || b.ratingCount - a.ratingCount || tieBreak(a, b),
      discount: (a, b) => (b.deal?.percent ?? 0) - (a.deal?.percent ?? 0) || tieBreak(a, b),
    };
    matches = matches.sort(sorters[sort] ?? sorters.relevance);

    const total = matches.length;
    const totalPages = Math.max(1, Math.ceil(total / size));
    const current = Math.min(Math.max(1, page), totalPages);
    const items = matches.slice((current - 1) * size, current * size).map(toSummary);
    return { items, page: current, pageSize: size, total, totalPages, facets };
  }

  function getById(id) {
    return byId.get(id) ?? null;
  }

  function getDetail(id) {
    const product = byId.get(id);
    if (!product) return null;
    const { titleLower, titleWords, haystack, reviews, ...detail } = product;
    return { ...detail, reviewCount: reviews.length, ratingBreakdown: breakdown(reviews) };
  }

  function breakdown(reviews) {
    const counts = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    for (const r of reviews) counts[r.rating] += 1;
    return counts;
  }

  function getReviews(id, { sort = 'recent', page = 1, pageSize = 10 } = {}) {
    const product = byId.get(id);
    if (!product) return null;
    const sorters = {
      recent: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)) || a.id - b.id,
      highest: (a, b) => b.rating - a.rating || a.id - b.id,
      lowest: (a, b) => a.rating - b.rating || a.id - b.id,
    };
    const sorted = [...product.reviews].sort(sorters[sort] ?? sorters.recent);
    const size = Math.min(Math.max(1, pageSize), 50);
    const totalPages = Math.max(1, Math.ceil(sorted.length / size));
    const current = Math.min(Math.max(1, page), totalPages);
    return {
      items: sorted.slice((current - 1) * size, current * size),
      page: current, pageSize: size, total: sorted.length, totalPages,
      breakdown: breakdown(product.reviews),
    };
  }

  /** Same category first, nearest price first; excludes the product itself. */
  function getRelated(id, limit = 8) {
    const product = byId.get(id);
    if (!product) return null;
    return products
      .filter((p) => p.id !== id && p.category.slug === product.category.slug)
      .sort((a, b) => Math.abs(a.finalPriceCents - product.finalPriceCents)
        - Math.abs(b.finalPriceCents - product.finalPriceCents) || a.id.localeCompare(b.id))
      .slice(0, limit)
      .map(toSummary);
  }

  /** Autocomplete: titles that start a word with the typed text, plus matching categories. */
  function suggest(q, limit = 8) {
    const tokens = tokenize(q);
    if (!tokens.length) return { products: [], categories: [] };
    const last = tokens[tokens.length - 1];
    const productHits = [];
    for (const p of products) {
      if (tokens.slice(0, -1).every((t) => p.haystack.includes(t)) && p.titleWords.some((w) => w.startsWith(last))) {
        productHits.push(p);
        if (productHits.length >= 200) break;
      }
    }
    productHits.sort((a, b) => b.ratingCount - a.ratingCount || a.id.localeCompare(b.id));
    return {
      products: productHits.slice(0, limit).map((p) => ({ id: p.id, title: p.title, category: p.category.label })),
      categories: categories.filter((c) => c.label.toLowerCase().includes(last)).slice(0, 3),
    };
  }

  return {
    size: products.length,
    skipped,
    categories,
    hasCategory: (slug) => categorySlugs.has(slug),
    search, getById, getDetail, getReviews, getRelated, suggest,
  };
}

let defaultCatalog = null;

/** Loads server/data/data.json once and reuses it. Throws a clear error if the file is unusable. */
export function getDefaultCatalog() {
  if (!defaultCatalog) {
    const parsed = JSON.parse(readFileSync(DATA_PATH, 'utf8'));
    if (!Array.isArray(parsed)) throw new Error('data.json must contain an array of products');
    defaultCatalog = createCatalog(parsed);
  }
  return defaultCatalog;
}
