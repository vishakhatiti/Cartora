import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import { addressSchema } from '../utils/addressSchema.js';

const startBody = z.object({ address: addressSchema });
const simulateBody = z.object({ outcome: z.enum(['success', 'failure']) });
const idParam = z.string().trim().min(1).max(64);

export function createCheckoutRouter({ checkout }) {
  const router = Router();
  const { provider } = checkout;
  const noStore = (res) => res.set('Cache-Control', 'no-store');
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
  const startLimit = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'Too many checkout attempts. Try again in a few minutes.', 'RATE_LIMITED')),
  });

  // Public: the page asks this to know whether to show the demo banner. The answer comes from the server's setting.
  router.get('/config', (_req, res) => {
    res.json({ provider: provider.name, demo: provider.isDemo, label: provider.label ?? null });
  });

  router.post('/sessions', requireAuth, startLimit, wrap(async (req, res) => {
    const { address } = startBody.parse(req.body);
    noStore(res).status(201).json(await checkout.startCheckout(req.user, address));
  }));

  router.get('/sessions/:id', requireAuth, wrap(async (req, res) => {
    noStore(res).json({ session: await checkout.getSession(req.user, idParam.parse(req.params.id)) });
  }));

  // Only exists while the demo provider is active. With Stripe, payment results arrive from the verified webhook instead.
  if (provider.isDemo) {
    router.post('/sessions/:id/simulate', requireAuth, wrap(async (req, res) => {
      const { outcome } = simulateBody.parse(req.body);
      const id = idParam.parse(req.params.id);
      await checkout.getSession(req.user, id); // 404 unless this session belongs to the signed-in user
      const result = await checkout.completeSession(id, outcome === 'success'
        ? { outcome: 'succeeded' }
        : { outcome: 'failed', reason: 'Demo payment declined. This was a simulated failure and nothing was charged.' });
      noStore(res).json({ demo: true, ...result });
    }));
  }

  return router;
}
