import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';
import { dollarsToCents } from '../utils/money.js';

// Letters, numbers, spaces and a few punctuation marks. Keeps store names readable and free of markup.
const activateBody = z.object({
  storeName: z.string().trim().min(2, 'Store name needs at least 2 characters.').max(60, 'Store name can be at most 60 characters.')
    .regex(/^[\p{L}\p{N} .,&'’-]+$/u, 'Use letters, numbers, spaces and . , & \' - only.'),
});

const imageUrl = z.string().trim().max(500).url('Enter a full image link.').refine((u) => u.startsWith('https://'), 'Image links must start with https://');
const productFields = {
  title: z.string().trim().min(3, 'Title needs at least 3 characters.').max(200),
  brand: z.string().trim().max(80),
  category: z.string().trim().min(1, 'Choose a category.').max(80),
  price: z.coerce.number({ invalid_type_error: 'Enter a price.' }).min(0.01, 'Price must be at least $0.01.').max(100000, 'Price is too high.'),
  stockQty: z.coerce.number().int('Stock must be a whole number.').min(0).max(100000),
  description: z.string().trim().max(4000),
  features: z.array(z.string().trim().min(1).max(200)).max(8),
  imageUrls: z.array(imageUrl).min(1, 'Add at least one image link.').max(4, 'You can add up to 4 images.'),
};
const toInput = ({ price, ...rest }) => ({ ...rest, ...(price !== undefined ? { priceCents: dollarsToCents(price) } : {}) });
const createProduct = z.object({ ...productFields, brand: productFields.brand.optional(), description: productFields.description.optional(), features: productFields.features.optional() }).transform(toInput);
const updateProduct = z.object({ ...productFields, isActive: z.boolean() }).partial().refine((v) => Object.keys(v).length > 0, 'Nothing to change.').transform(toInput);
const idParam = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Invalid id');
const orderIdParam = z.string().trim().min(1).max(64);

export function createSellerRouter({ authService, seller }) {
  const router = Router();
  const activateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'Too many attempts. Try again in a few minutes.', 'RATE_LIMITED')),
  });

  // Become a seller with the account you already have.
  router.post('/activate', requireAuth, activateLimit, async (req, res, next) => {
    try {
      const { storeName } = activateBody.parse(req.body);
      const user = await authService.becomeSeller(req.user, storeName);
      res.set('Cache-Control', 'no-store').json({ user: authService.publicUser(user) });
    } catch (err) {
      next(err);
    }
  });

  const guard = [requireAuth, requireSeller];
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
  const noStore = (res) => res.set('Cache-Control', 'no-store');

  router.get('/me', ...guard, (req, res) => {
    noStore(res).json({ store: { name: req.user.storeName } });
  });
  router.get('/summary', ...guard, wrap(async (req, res) => noStore(res).json({ summary: await seller.summary(req.user) })));

  router.get('/products', ...guard, wrap(async (req, res) => noStore(res).json({ products: await seller.list(req.user) })));
  router.post('/products', ...guard, wrap(async (req, res) => {
    noStore(res).status(201).json({ product: await seller.create(req.user, createProduct.parse(req.body)) });
  }));
  router.put('/products/:id', ...guard, wrap(async (req, res) => {
    noStore(res).json({ product: await seller.update(req.user, idParam.parse(req.params.id), updateProduct.parse(req.body)) });
  }));

  router.get('/orders', ...guard, wrap(async (req, res) => noStore(res).json({ orders: await seller.orders(req.user) })));
  router.post('/orders/:id/ship', ...guard, wrap(async (req, res) => {
    noStore(res).json({ order: await seller.ship(req.user, orderIdParam.parse(req.params.id)) });
  }));

  return router;
}
