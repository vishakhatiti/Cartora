import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';

/** The signed-in user's notifications. Polling-friendly: one small GET, one POST to mark everything read. */
export function createNotificationsRouter({ notifications }) {
  const router = Router();
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
  router.get('/', requireAuth, wrap(async (req, res) => res.set('Cache-Control', 'no-store').json(await notifications.list(req.user.id))));
  router.post('/read', requireAuth, wrap(async (req, res) => res.set('Cache-Control', 'no-store').json(await notifications.markAllRead(req.user.id))));
  return router;
}
