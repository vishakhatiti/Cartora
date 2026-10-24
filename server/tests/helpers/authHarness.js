import { createAuthService } from '../../src/services/auth/authService.js';
import { createMemoryStore } from '../../src/services/auth/memoryStore.js';
import { createPasswordHasher } from '../../src/services/auth/passwords.js';

export const SECRET = 'test-secret-that-is-at-least-32-characters-long';
// Cheap scrypt settings keep tests fast; production uses the defaults.
export const fastHasher = createPasswordHasher({ N: 2 ** 10, r: 8, p: 1 });

/** Auth service on an in-memory store, a mailer that records messages, and a clock tests can move. */
export function createHarness({ store = createMemoryStore(), startAt = new Date('2026-01-01T00:00:00Z') } = {}) {
  let time = startAt.getTime();
  const outbox = [];
  const mailer = { send: async (message) => { outbox.push(message); } };
  const service = createAuthService({ store, mailer, hasher: fastHasher, secret: SECRET, now: () => new Date(time) });
  return {
    store, service, outbox,
    advance: (seconds) => { time += seconds * 1000; },
    lastCode: () => outbox.at(-1)?.text.match(/Your code: (\d{6})/)?.[1],
  };
}
