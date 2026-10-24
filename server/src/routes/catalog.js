import { Router } from 'express';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { dollarsToCents } from '../utils/money.js';
import { MAX_PAGE_SIZE, DISCOVER_KINDS, SORTS, REVIEW_SORTS, DEFAULT_PAGE_SIZE } from '../services/catalog/catalog.js';

const ID_PATTERN = /^[A-Za-z0-9_-]{1,40}$/;

const dollarsParam = z.coerce.number().min(0).max(1_000_000).transform((v) => dollarsToCents(v));
const boolParam = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const searchQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: z.string().trim().max(80).optional(),
  // ?brand=A&brand=B or ?brand=A,B
  brand: z.union([z.string(), z.array(z.string())]).optional(),
  minPrice: dollarsParam.optional(),
  maxPrice: dollarsParam.optional(),
  minRating: z.coerce.number().min(0).max(5).optional(),
  deals: boolParam.optional(),
  sort: z.enum(SORTS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
});

const reviewsQuery = z.object({
  sort: z.enum(REVIEW_SORTS).optional(),
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(50).optional(),
});

// ZodError is turned into a 400 VALIDATION_ERROR by the central error handler.
const parse = (schema, query) => schema.parse(query);

function productOr404(value) {
  if (!value) throw new AppError(404, 'Product not found', 'NOT_FOUND');
  return value;
}

/** Public, read-only catalog endpoints. getCatalog is a function so the data loads on first use. */
export function createCatalogRouter(getCatalog) {
  const router = Router();
  const cacheable = (res) => res.set('Cache-Control', 'public, max-age=60');

  router.get('/categories', (_req, res) => {
    cacheable(res).json({ categories: getCatalog().categories });
  });

  router.get('/search/suggestions', (req, res) => {
    const { q } = parse(z.object({ q: z.string().trim().max(100).default('') }), req.query);
    cacheable(res).json(getCatalog().suggest(q));
  });

  router.get('/products', (req, res) => {
    const query = parse(searchQuery, req.query);
    if (query.minPrice != null && query.maxPrice != null && query.minPrice > query.maxPrice) {
      throw new AppError(400, 'minPrice cannot be greater than maxPrice', 'VALIDATION_ERROR');
    }
    const catalog = getCatalog();
    const brands = (Array.isArray(query.brand) ? query.brand : [query.brand])
      .filter(Boolean)
      .flatMap((b) => b.split(','))
      .map((b) => b.trim())
      .filter(Boolean)
      .slice(0, 20);
    const result = catalog.search({
      q: query.q,
      category: query.category,
      brands,
      minPriceCents: query.minPrice,
      maxPriceCents: query.maxPrice,
      minRating: query.minRating,
      dealsOnly: query.deals,
      sort: query.sort,
      page: query.page,
      pageSize: query.pageSize ?? DEFAULT_PAGE_SIZE,
    });
    cacheable(res).json(result);
  });

  router.get('/discover/:kind', (req, res) => {
    const kind = z.enum(DISCOVER_KINDS).safeParse(req.params.kind);
    if (!kind.success) throw new AppError(404, 'Unknown shelf', 'NOT_FOUND');
    const query = parse(z.object({
      category: z.string().trim().max(80).optional(),
      page: z.coerce.number().int().min(1).max(10_000).optional(),
      pageSize: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).optional(),
    }), req.query);
    const catalog = getCatalog();
    if (query.category && !catalog.hasCategory(query.category)) throw new AppError(404, 'Unknown category', 'NOT_FOUND');
    cacheable(res).json(catalog.discover(kind.data, query));
  });

  router.get('/products/:id', (req, res) => {
    const id = ID_PATTERN.test(req.params.id) ? req.params.id : null;
    // Price and stock can change when a seller edits a listing or a sale completes, so browsers must revalidate (ETag keeps it cheap).
    res.set('Cache-Control', 'public, max-age=0, must-revalidate').json({ product: productOr404(id && getCatalog().getDetail(id)) });
  });

  router.get('/products/:id/reviews', (req, res) => {
    const id = ID_PATTERN.test(req.params.id) ? req.params.id : null;
    const query = parse(reviewsQuery, req.query);
    cacheable(res).json(productOr404(id && getCatalog().getReviews(id, query)));
  });

  router.get('/products/:id/related', (req, res) => {
    const id = ID_PATTERN.test(req.params.id) ? req.params.id : null;
    cacheable(res).json({ items: productOr404(id && getCatalog().getRelated(id)) });
  });

  return router;
}
