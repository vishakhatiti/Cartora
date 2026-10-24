import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);

// OWASP's scrypt guidance: N=2^15, r=8, p=3 (about 32 MiB per hash). The parameters are stored in
// each hash, so they can be raised later without locking anyone out.
export const DEFAULT_PARAMS = { N: 2 ** 15, r: 8, p: 3 };
const KEY_LENGTH = 32;

const maxmemFor = ({ N, r }) => 128 * N * r * 2;

/** Create a password hasher. Tests pass cheaper parameters; production uses the defaults. */
export function createPasswordHasher(params = DEFAULT_PARAMS) {
  async function hash(password) {
    const salt = randomBytes(16);
    const key = await scryptAsync(password, salt, KEY_LENGTH, { ...params, maxmem: maxmemFor(params) });
    return ['scrypt', params.N, params.r, params.p, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async function verify(password, stored) {
    if (typeof stored !== 'string') return false;
    const [scheme, N, r, p, saltB64, keyB64] = stored.split('$');
    if (scheme !== 'scrypt' || !keyB64) return false;
    const stored_params = { N: Number(N), r: Number(r), p: Number(p) };
    if (![stored_params.N, stored_params.r, stored_params.p].every(Number.isInteger)) return false;
    const expected = Buffer.from(keyB64, 'base64');
    const actual = await scryptAsync(password, Buffer.from(saltB64, 'base64'), expected.length, {
      ...stored_params,
      maxmem: maxmemFor(stored_params),
    });
    return actual.length === expected.length && timingSafeEqual(actual, expected);
  }

  return { hash, verify };
}
