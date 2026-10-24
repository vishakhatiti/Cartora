import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { MAX_QTY_PER_ITEM } from '../utils/money.js';
import { MAX_CART_LINES } from '../services/commerce/pricing.js';

const productId = z.string().trim().regex(/^[A-Za-z0-9_-]{1,40}$/, 'Invalid product id');
const qty = z.number().int().min(1).max(MAX_QTY_PER_ITEM);
const itemList = z.object({ items: z.array(z.object({ productId, qty })).max(MAX_CART_LINES) });

/**
 * Cart endpoints. POST /cart/quote is public and prices a guest's browser cart without saving anything;
 * everything else needs a signed-in user. Prices always come from the catalogue, never from the request.
 */
export function createCartRouter({ carts }) {
  const router = Router();
  const noStore = (res) => res.set('Cache-Control', 'no-store');
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

  router.post('/quote', wrap(async (req, res) => {
    noStore(res).json({ cart: carts.quote(itemList.parse(req.body).items) });
  }));

  router.get('/', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ cart: await carts.get(req.user.id) });
  }));

  router.put('/items/:productId', requireAuth, wrap(async (req, res) => {
    const id = productId.parse(req.params.productId);
    const { qty: quantity } = z.object({ qty }).parse(req.body);
    noStore(res).json({ cart: await carts.setQuantity(req.user.id, id, quantity) });
  }));

  router.delete('/items/:productId', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ cart: await carts.remove(req.user.id, productId.parse(req.params.productId)) });
  }));

  router.post('/merge', requireAuth, wrap(async (req, res) => {
    noStore(res).json(await carts.merge(req.user.id, itemList.parse(req.body).items));
  }));

  router.delete('/', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ cart: await carts.clear(req.user.id) });
  }));

  return router;
}
