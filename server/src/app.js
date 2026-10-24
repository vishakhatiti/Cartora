import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import healthRouter from './routes/health.js';
import { createCatalogRouter } from './routes/catalog.js';
import { getDefaultCatalog } from './services/catalog/catalog.js';
import { createAuthRouter } from './routes/auth.js';
import { loadUser } from './middleware/auth.js';
import { createAuthService } from './services/auth/authService.js';
import { createMongoStore } from './services/auth/mongoStore.js';
import { createPasswordHasher } from './services/auth/passwords.js';
import { createGoogleVerifier } from './services/auth/googleVerifier.js';
import { createMailer } from './services/mail/mailer.js';
import { notFound, createErrorHandler } from './middleware/errorHandler.js';

/**
 * Build the Express app. Takes validated env so tests can pass their own,
 * an optional catalog (tests pass a small fixture; production loads the catalogue file on first use),
 * and an optional auth service (tests pass one built on an in-memory store).
 */
export function createApp(env, { catalog, authService } = {}) {
  const app = express();

  app.disable('x-powered-by');
  // The API sits behind Render's proxy (and Vercel's rewrite). The deployment feature
  // must confirm the exact proxy count so rate limiting keys on the real client IP.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  // The Stripe webhook (added in the checkout feature) mounts its raw-body route BEFORE this.
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());
  app.use(
    '/api',
    rateLimit({ windowMs: 15 * 60 * 1000, limit: 300, standardHeaders: 'draft-7', legacyHeaders: false }),
  );

  // JWT_SECRET is optional in development; without it the auth routes answer 503 instead of crashing the app.
  const auth = authService ?? createAuthService({
    store: createMongoStore(),
    mailer: createMailer(env),
    hasher: createPasswordHasher(),
    secret: env.JWT_SECRET,
    googleVerifier: createGoogleVerifier(env.GOOGLE_CLIENT_ID),
  });
  app.use(loadUser({ authService: auth, secret: env.JWT_SECRET }));

  app.use('/api/health', healthRouter);
  app.use('/api/auth', createAuthRouter({ authService: auth, env, secret: env.JWT_SECRET }));
  app.use('/api', createCatalogRouter(() => catalog ?? getDefaultCatalog()));

  app.use(notFound);
  app.use(createErrorHandler(env));
  return app;
}
