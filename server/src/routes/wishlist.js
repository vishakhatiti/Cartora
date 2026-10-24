import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const productId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Invalid product id');

/** Wishlist endpoints. Signed-in users only; ids are validated and checked against the catalogue. */
export function createWishlistRouter({ wishlist }) {
  const router = Router();
  const noStore = (res) => res.set('Cache-Control', 'no-store');
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

  router.get('/', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ wishlist: await wishlist.get(req.user.id) });
  }));
  router.put('/items/:productId', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ wishlist: await wishlist.add(req.user.id, productId.parse(req.params.productId)) });
  }));
  router.delete('/items/:productId', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ wishlist: await wishlist.remove(req.user.id, productId.parse(req.params.productId)) });
  }));
  return router;
}
