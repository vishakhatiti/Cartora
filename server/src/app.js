import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import { notFound, createErrorHandler } from './middleware/errorHandler.js';

/** Build the Express app. Takes validated env so tests can pass their own. */
export function createApp(env) {
  const app = express();

  app.disable('x-powered-by');
  // The API sits behind Render's proxy (and Vercel's rewrite). The deployment feature
  // must confirm the exact proxy count so rate limiting keys on the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_URL, credentials: true }));
  // The Stripe webhook (added in the checkout feature) mounts its raw-body route BEFORE this.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }),
  );

  app.use('/api/health', healthRouter);

  app.use(notFound);
  app.use(createErrorHandler(env));
  return app;
}
