import { createHmac, hkdfSync, randomInt, timingSafeEqual } from 'node:crypto';

/** A random 6-digit code from a cryptographically secure generator. */
export function generateCode() {
  return String(randomInt(0, 1_000_000)).padStart(6, '0');
}

/**
 * Only a keyed hash of a code is stored. The key is derived from JWT_SECRET, so a copy of the database
 * alone cannot be used to look codes up (a 6-digit code has only a million possibilities).
 * The email and purpose are part of the hash, so a code for one cannot be replayed for another.
 */
export function createOtpHasher(secret) {
  if (!secret) throw new Error('JWT_SECRET is required to hash one-time codes');
  const key = Buffer.from(hkdfSync('sha256', secret, 'cartora', 'otp-v1', 32));

  const hash = (email, purpose, code) =>
    createHmac('sha256', key).update(`${email}\n${purpose}\n${code}`).digest('hex');

  const matches = (email, purpose, code, expectedHash) => {
    const actual = Buffer.from(hash(email, purpose, code), 'hex');
    const expected = Buffer.from(String(expectedHash), 'hex');
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  };

  return { hash, matches };
}
