import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { requireAuth, requireSeller } from '../middleware/auth.js';

// Letters, numbers, spaces and a few punctuation marks. Keeps store names readable and free of markup.
const activateBody = z.object({
  storeName: z.string().trim().min(2, 'Store name needs at least 2 characters.').max(60, 'Store name can be at most 60 characters.')
    .regex(/^[\p{L}\p{N} .,&'’-]+$/u, 'Use letters, numbers, spaces and . , & \' - only.'),
});

export function createSellerRouter({ authService }) {
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

  // The seller's own workspace summary. Listings and orders are added by later features.
  router.get('/me', requireAuth, requireSeller, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ store: { name: req.user.storeName } });
  });

  return router;
}
