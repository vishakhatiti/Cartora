import jwt from 'jsonwebtoken';

export const SESSION_COOKIE = 'cartora_session';
export const SESSION_DAYS = 7;

export function signSession(secret, user) {
  return jwt.sign({ sub: user.id, tv: user.tokenVersion ?? 0 }, secret, {
    algorithm: 'HS256',
    expiresIn: `${SESSION_DAYS}d`,
  });
}

/** Returns { userId, tokenVersion } or null for any invalid, expired or tampered token. */
export function readSession(secret, token) {
  try {
    const payload = jwt.verify(token, secret, { algorithms: ['HS256'] });
    if (typeof payload.sub !== 'string') return null;
    return { userId: payload.sub, tokenVersion: payload.tv ?? 0 };
  } catch {
    return null;
  }
}

/** httpOnly keeps the token away from page scripts; SameSite=Lax blocks cross-site POSTs. */
export function cookieOptions(env) {
  return {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  };
}
