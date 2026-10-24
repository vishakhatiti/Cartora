import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';

const idParam = z.string().trim().min(1).max(64);

/** A buyer's own orders. Another user's order id answers 404, the same as an id that does not exist. */
export function createOrdersRouter({ checkout }) {
  const router = Router();
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

  router.get('/', requireAuth, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ orders: await checkout.listOrders(req.user) });
  }));

  router.get('/:id', requireAuth, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ order: await checkout.getOrder(req.user, idParam.parse(req.params.id)) });
  }));

  return router;
}
