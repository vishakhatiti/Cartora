import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { AppError } from '../utils/AppError.js';
import { RESEND_COOLDOWN_SECONDS } from '../services/auth/authService.js';
import { SESSION_COOKIE, signSession, cookieOptions } from '../services/auth/tokens.js';
import { requireAuth } from '../middleware/auth.js';

const email = z.string().trim().toLowerCase().max(254).pipe(z.email());
const code = z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code');
const password = z.string().min(8, 'Use at least 8 characters').max(128, 'Use at most 128 characters');
const name = z.string().trim().min(1, 'Enter your name').max(80);

const schemas = {
  register: z.object({ name, email, password }),
  emailOnly: z.object({ email }),
  verify: z.object({ email, code }),
  login: z.object({ email, password: z.string().min(1).max(128) }),
  reset: z.object({ email, code, newPassword: password }),
  google: z.object({ credential: z.string().min(20).max(5000) }),
};

const limiter = (limit, message) =>
  rateLimit({
    windowMs: 15 * 60 * 1000, limit, standardHeaders: 'draft-7', legacyHeaders: false,
    handler: (_req, _res, next) => next(new AppError(429, message, 'RATE_LIMITED')),
  });

const GENERIC_SENT = `If that email can be used, a code is on its way. You can ask for another after ${RESEND_COOLDOWN_SECONDS} seconds.`;

export function createAuthRouter({ authService, env, secret }) {
  const router = Router();
  const ready = (_req, _res, next) =>
    secret ? next() : next(new AppError(503, 'Sign-in is not configured on the server.', 'AUTH_NOT_CONFIGURED'));

  // Sign-in attempts per IP are limited more tightly than the rest of the API.
  const credentialLimit = limiter(20, 'Too many attempts. Try again in a few minutes.');
  const codeRequestLimit = limiter(10, 'Too many code requests. Try again in a few minutes.');

  const startSession = (res, user) => {
    res.cookie(SESSION_COOKIE, signSession(secret, user), cookieOptions(env));
    return res.json({ user: authService.publicUser(user) });
  };
  const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res)).catch(next);
  const sent = (res) => res.status(202).json({ message: GENERIC_SENT });

  router.use(ready);

  router.post('/register', codeRequestLimit, handler(async (req, res) => {
    await authService.register(schemas.register.parse(req.body));
    sent(res);
  }));

  router.post('/verify-email', credentialLimit, handler(async (req, res) => {
    startSession(res, await authService.verifyEmail(schemas.verify.parse(req.body)));
  }));

  router.post('/resend-verification', codeRequestLimit, handler(async (req, res) => {
    await authService.resendVerification(schemas.emailOnly.parse(req.body));
    sent(res);
  }));

  router.post('/login', credentialLimit, handler(async (req, res) => {
    startSession(res, await authService.login(schemas.login.parse(req.body)));
  }));

  router.post('/login-code/request', codeRequestLimit, handler(async (req, res) => {
    await authService.requestLoginCode(schemas.emailOnly.parse(req.body));
    sent(res);
  }));

  router.post('/login-code/verify', credentialLimit, handler(async (req, res) => {
    startSession(res, await authService.verifyLoginCode(schemas.verify.parse(req.body)));
  }));

  router.post('/google', credentialLimit, handler(async (req, res) => {
    startSession(res, await authService.googleSignIn(schemas.google.parse(req.body)));
  }));

  router.post('/forgot', codeRequestLimit, handler(async (req, res) => {
    await authService.forgotPassword(schemas.emailOnly.parse(req.body));
    sent(res);
  }));

  router.post('/reset', credentialLimit, handler(async (req, res) => {
    startSession(res, await authService.resetPassword(schemas.reset.parse(req.body)));
  }));

  router.post('/logout', (_req, res) => {
    const { maxAge, ...options } = cookieOptions(env);
    res.clearCookie(SESSION_COOKIE, options);
    res.status(204).end();
  });

  router.get('/me', requireAuth, (req, res) => {
    res.set('Cache-Control', 'no-store').json({ user: authService.publicUser(req.user) });
  });

  return router;
}
