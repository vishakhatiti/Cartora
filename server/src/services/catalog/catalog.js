import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { normalizeProduct, toSummary } from './normalize.js';
import { isCatalogueV2, iterateCatalogueV2 } from './formats.js';

export const DEFAULT_PAGE_SIZE = 24;
export const MAX_PAGE_SIZE = 48;
export const DISCOVER_KINDS = ['trending', 'best-sellers', 'new-releases'];
export const SORTS = ['relevance', 'price_asc', 'price_desc', 'rating', 'discount'];
export const REVIEW_SORTS = ['recent', 'highest', 'lowest'];

export const DATA_PATH = fileURLToPath(new URL('../../../data/data.json', import.meta.url));
export const STOCK_IMAGES_PATH = fileURLToPath(new URL('../../../data/category-images.json', import.meta.url));
export const GZ_PATH = fileURLToPath(new URL('../../../data/catalogue.json.gz', import.meta.url));

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

/** Small stable string hash (FNV-1a) so a product always gets the same stock photo. */
export function hashString(text) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash;
}

/**
 * Read-only, in-memory catalog built from the dataset records.
 * stockImages (optional) is the parsed category-images.json: generic category photos used for products
 * that have no photo of their own. They are labelled imageKind 'stock' because they do not show the product.
 */
export function createCatalog(rawProducts, { stockImages = null } = {}) {
  const stockByCategory = stockImages?.categories ?? {};
  const products = [];
  const byId = new Map();
  let skipped = 0;

  for (const raw of rawProducts) {
    const product = normalizeProduct(raw);
    if (!product || byId.has(product.id)) {
      skipped += 1;
      continue;
    }
    const pool = stockByCategory[product.category.slug];
    const stock = !product.hasRealImage && Array.isArray(pool) && pool.length
      ? pool[hashString(product.id) % pool.length]
      : null;
    const indexed = {
      ...product,
      imageKind: product.hasRealImage ? 'real' : stock ? 'stock' : 'none',
      stockImage: stock && {
        thumb: stock.thumb, large: stock.large, alt: stock.alt,
        credit: { photographer: stock.photographer, photographerUrl: stock.photographerUrl, pageUrl: stock.pageUrl },
      },
      titleLower: product.title.toLowerCase(),
      titleWords: tokenize(product.title),
      // Everything a shopper can search on, built once.
      haystack: `${product.title} ${product.brand} ${product.category.label}`.toLowerCase(),
    };
    products.push(indexed);
    byId.set(indexed.id, indexed);
  }

  // Categories are recomputed whenever a seller listing is added or removed, so counts stay true.
  let categories = [];
  let categorySlugs = new Set();
  function rebuildCategories() {
    categories = [...countBy(products, (p) => p.category.slug)].map(([slug, count]) => ({
      slug,
      label: products.find((p) => p.category.slug === slug).category.label,
      count,
    })).sort((a, b) => a.label.localeCompare(b.label));
    categorySlugs = new Set(categories.map((c) => c.slug));
  }
  rebuildCategories();

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

  /** The listing shape for one product, or null. */
  function getSummary(id) {
    const product = byId.get(id);
    return product ? toSummary(product) : null;
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

  /** Add or replace one seller listing at runtime (raw listing shape, same as a dataset record). Returns the product or null. */
  function upsert(raw) {
    const product = normalizeProduct(raw);
    if (!product) return null;
    const indexed = {
      ...product,
      imageKind: product.hasRealImage ? 'real' : 'none',
      stockImage: null,
      titleLower: product.title.toLowerCase(),
      titleWords: tokenize(product.title),
      haystack: `${product.title} ${product.brand} ${product.category.label}`.toLowerCase(),
    };
    const existing = byId.get(indexed.id);
    if (existing) products.splice(products.indexOf(existing), 1, indexed); else products.push(indexed);
    byId.set(indexed.id, indexed);
    changed();
    return indexed;
  }

  /** Take a listing out of the shop (deactivated or deleted). Dataset products can be removed the same way but are not. */
  function remove(id) {
    const existing = byId.get(id);
    if (!existing) return false;
    products.splice(products.indexOf(existing), 1);
    byId.delete(id);
    changed();
    return true;
  }

  function changed() {
    rebuildCategories();
    shelves.clear();
  }

  // Discovery shelves. The data has no sales figures or release dates, so these are ranked from real review
  // activity only, and each result says what the ranking means. The generated importedRank/isBestSeller are never used.
  const DAY = 86_400_000;
  const stamp = (r) => { const t = Date.parse(r.createdAt); return Number.isFinite(t) ? t : null; };
  const reviewTimes = new Map(products.map((p) => [p.id, p.reviews.map(stamp).filter((t) => t != null)]));
  let windowEnd = 0;
  for (const times of reviewTimes.values()) for (const t of times) if (t > windowEnd) windowEnd = t;
  const BASIS = {
    trending: 'Ranked by reviews written in the most recent 12 months of the review data.',
    'best-sellers': 'Most-rated products with an average of 4 stars or more. Sales figures are not available.',
    'new-releases': 'Newly listed seller products first, then products whose first review is the most recent. Release dates are not available.',
  };
  const shelves = new Map();
  function shelf(kind) {
    if (shelves.has(kind)) return shelves.get(kind);
    const times = (p) => reviewTimes.get(p.id) ?? []; // seller listings have no dataset reviews
    const recent = (p) => times(p).filter((t) => t >= windowEnd - 365 * DAY).length;
    const first = (p) => (p.listedAt ? Date.parse(p.listedAt) : Math.min(...times(p)));
    const rules = {
      trending: { keep: (p) => recent(p) > 0, score: recent },
      'best-sellers': { keep: (p) => p.ratingAvg >= 4 && p.ratingCount > 0, score: (p) => p.ratingCount },
      'new-releases': { keep: (p) => Boolean(p.listedAt) || times(p).length > 0, score: first },
    }[kind];
    const ranked = products.filter(rules.keep).map((p) => [p, rules.score(p)])
      .sort((a, b) => b[1] - a[1] || b[0].ratingCount - a[0].ratingCount || a[0].id.localeCompare(b[0].id))
      .map(([p]) => p);
    shelves.set(kind, ranked);
    return ranked;
  }

  function discover(kind, { category, page = 1, pageSize = 12 } = {}) {
    if (!DISCOVER_KINDS.includes(kind)) return null;
    const all = shelf(kind).filter((p) => !category || p.category.slug === category);
    const size = Math.min(Math.max(1, pageSize), MAX_PAGE_SIZE);
    const totalPages = Math.max(1, Math.ceil(all.length / size));
    const current = Math.min(Math.max(1, page), totalPages);
    return { kind, basis: BASIS[kind], items: all.slice((current - 1) * size, current * size).map(toSummary), page: current, pageSize: size, total: all.length, totalPages };
  }

  return {
    get size() { return products.length; },
    skipped,
    get categories() { return categories; },
    hasCategory: (slug) => categorySlugs.has(slug),
    search, discover, upsert, remove, getById, getSummary, getDetail, getReviews, getRelated, suggest,
  };
}

let defaultCatalog = null;

/** Read a catalog file: plain .json or gzip-compressed .json.gz. Throws a clear error if unusable. */
export function loadStockImages(path = STOCK_IMAGES_PATH) {
  if (!existsSync(path)) return null;
  const parsed = JSON.parse(readFileSync(path, 'utf8'));
  return parsed && typeof parsed.categories === 'object' ? parsed : null;
}

/** Read and parse in their own scope so the file bytes and the JSON text can be freed before indexing. */
function parseCatalogFile(path) {
  const bytes = readFileSync(path);
  const text = path.endsWith('.gz') ? gunzipSync(bytes).toString('utf8') : bytes.toString('utf8');
  return JSON.parse(text);
}

export function loadCatalogFile(path, { stockImages = null } = {}) {
  const parsed = parseCatalogFile(path);
  // Two layouts are accepted: a plain array of dataset records, or the catalogue.json.gz object.
  const records = isCatalogueV2(parsed) ? iterateCatalogueV2(parsed, { release: true }) : parsed;
  if (!Array.isArray(parsed) && !isCatalogueV2(parsed)) throw new Error(`${path} must contain an array of products`);
  return createCatalog(records, { stockImages });
}

/**
 * Loads the catalog once and reuses it. Prefers catalogue.json.gz (built from Amazon Reviews 2023 by
 * scripts/build_catalog.py) and falls back to the bundled data.json.
 */
export function getDefaultCatalog() {
  if (!defaultCatalog) {
    defaultCatalog = loadCatalogFile(existsSync(GZ_PATH) ? GZ_PATH : DATA_PATH, { stockImages: loadStockImages() });
  }
  return defaultCatalog;
}
