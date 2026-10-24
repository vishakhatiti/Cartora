import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { requireAuth } from '../middleware/auth.js';
import { TICKET_TOPICS } from '../models/SupportTicket.js';

const body = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email address.').max(254),
  topic: z.enum(TICKET_TOPICS),
  orderNumber: z.string().trim().regex(/^CRT-[A-Z0-9]{8}$/i, 'Order numbers look like CRT-ABCD2345.').transform((v) => v.toUpperCase()).optional().or(z.literal('').transform(() => undefined)),
  message: z.string().trim().min(10, 'Please write at least 10 characters.').max(2000),
});

/** Customer service. Anyone can send a request (guests give an email); only signed-in users can list theirs. */
export function createSupportRouter({ support }) {
  const router = Router();
  const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };
  const limit = rateLimit({
    windowMs: 60 * 60 * 1000, limit: 10, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, 'Too many requests. Please try again later.', 'RATE_LIMITED')),
  });

  router.post('/tickets', limit, wrap(async (req, res) => {
    const data = body.parse(req.body);
    res.set('Cache-Control', 'no-store').status(201).json({ ticket: await support.create(req.user, data) });
  }));
  router.get('/tickets', requireAuth, wrap(async (req, res) => {
    res.set('Cache-Control', 'no-store').json({ tickets: await support.listMine(req.user.id) });
  }));
  return router;
}
