import { AppError } from '../utils/AppError.js';
import { SESSION_COOKIE, readSession } from '../services/auth/tokens.js';

/** Loads req.user from the session cookie when it is valid. Does not reject anonymous requests. */
export function loadUser({ authService, secret }) {
  return async (req, _res, next) => {
    try {
      const token = req.cookies?.[SESSION_COOKIE];
      if (token && secret) {
        const session = readSession(secret, token);
        if (session) req.user = (await authService.userForSession(session)) ?? undefined;
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}

/** Rejects requests without a signed-in user. Use after loadUser. */
export function requireAuth(req, _res, next) {
  if (!req.user) return next(new AppError(401, 'Please sign in.', 'UNAUTHENTICATED'));
  return next();
}
