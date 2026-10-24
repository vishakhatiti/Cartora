import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createMemoryStore } from '../../src/services/auth/memoryStore.js';
import { createMongoStore } from '../../src/services/auth/mongoStore.js';
import { User } from '../../src/models/User.js';
import { Otp } from '../../src/models/Otp.js';
import { createHarness } from '../helpers/authHarness.js';

// The same behaviour tests run against the in-memory store (always) and against real MongoDB when
// MONGO_TEST_URL is set (CI starts a MongoDB service container). Locally without MongoDB they are skipped.
const MONGO_TEST_URL = process.env.MONGO_TEST_URL;

const targets = [
  { name: 'memory store', make: async () => createMemoryStore() },
  ...(MONGO_TEST_URL ? [{
    name: 'MongoDB store',
    make: async () => {
      await Promise.all([User.deleteMany({}), Otp.deleteMany({})]);
      return createMongoStore();
    },
  }] : []),
];

beforeAll(async () => {
  if (MONGO_TEST_URL) {
    await mongoose.connect(MONGO_TEST_URL, { serverSelectionTimeoutMS: 15000 });
    await Promise.all([User.init(), Otp.init()]); // build the unique and TTL indexes
  }
});
afterAll(async () => {
  if (MONGO_TEST_URL) await mongoose.disconnect();
});

describe.each(targets)('auth store contract: $name', ({ make }) => {
  let store;
  beforeEach(async () => { store = await make(); });

  it('creates and finds users by email and id', async () => {
    const user = await store.createUser({ email: 'a@x.com', name: 'A', passwordHash: 'h' });
    expect(user).toMatchObject({ email: 'a@x.com', name: 'A', emailVerified: false, tokenVersion: 0, passwordHash: 'h' });
    expect((await store.findUserByEmail('a@x.com')).id).toBe(user.id);
    expect((await store.findUserById(user.id)).email).toBe('a@x.com');
    expect(await store.findUserByEmail('missing@x.com')).toBeNull();
    expect(await store.findUserById('not-an-id')).toBeNull();
  });

  it('rejects a duplicate email with code DUPLICATE or 11000', async () => {
    await store.createUser({ email: 'a@x.com', name: 'A' });
    const err = await store.createUser({ email: 'a@x.com', name: 'B' }).catch((e) => e);
    expect([err.code]).toSatisfy(([c]) => c === 'DUPLICATE' || c === 11000);
  });

  it('updates fields, unsets purgeAt and bumps tokenVersion', async () => {
    const user = await store.createUser({ email: 'a@x.com', name: 'A', purgeAt: new Date(Date.now() + 1e6) });
    const updated = await store.updateUser(user.id, { set: { emailVerified: true }, unset: ['purgeAt'], incTokenVersion: true });
    expect(updated).toMatchObject({ emailVerified: true, tokenVersion: 1, purgeAt: null });
    expect(await store.updateUser('0'.repeat(24), { set: { name: 'x' } })).toBeNull();
  });

  it('stores and finds Google ids, and leaves them empty for password accounts', async () => {
    const g = await store.createUser({ email: 'g@x.com', name: 'G', emailVerified: true, googleId: 'sub-1', avatarUrl: 'https://x/a.jpg' });
    const p1 = await store.createUser({ email: 'p1@x.com', name: 'P1', passwordHash: 'h' });
    const p2 = await store.createUser({ email: 'p2@x.com', name: 'P2', passwordHash: 'h' }); // two users with no googleId must be allowed
    expect(g).toMatchObject({ googleId: 'sub-1', avatarUrl: 'https://x/a.jpg' });
    expect((await store.findUserByGoogleId('sub-1')).id).toBe(g.id);
    expect(await store.findUserByGoogleId('nope')).toBeNull();
    expect([p1.googleId, p2.googleId]).toEqual([null, null]);
    const cleared = await store.updateUser(p1.id, { set: { passwordHash: null } });
    expect(cleared.passwordHash).toBeNull();
  });

  const future = () => new Date(Date.now() + 10 * 60 * 1000);

  it('keeps one code per email and purpose', async () => {
    const first = await store.replaceOtp({ email: 'a@x.com', purpose: 'login', codeHash: 'h1', expiresAt: future() });
    const second = await store.replaceOtp({ email: 'a@x.com', purpose: 'login', codeHash: 'h2', expiresAt: future() });
    expect(second.id).not.toBe(first.id);
    expect((await store.findActiveOtp('a@x.com', 'login')).codeHash).toBe('h2');
    await store.replaceOtp({ email: 'a@x.com', purpose: 'reset_password', codeHash: 'h3', expiresAt: future() });
    expect((await store.findActiveOtp('a@x.com', 'login')).codeHash).toBe('h2');
  });

  it('ignores expired and consumed codes', async () => {
    const expired = await store.replaceOtp({ email: 'a@x.com', purpose: 'login', codeHash: 'h', expiresAt: new Date(Date.now() - 1000) });
    expect(await store.findActiveOtp('a@x.com', 'login')).toBeNull();
    expect((await store.findLatestOtp('a@x.com', 'login')).id).toBe(expired.id);
    const live = await store.replaceOtp({ email: 'a@x.com', purpose: 'login', codeHash: 'h', expiresAt: future() });
    expect(await store.consumeOtp(live.id)).toBe(true);
    expect(await store.findActiveOtp('a@x.com', 'login')).toBeNull();
  });

  it('counts attempts atomically and lets exactly one caller consume a code', async () => {
    const otp = await store.replaceOtp({ email: 'a@x.com', purpose: 'login', codeHash: 'h', expiresAt: future() });
    const counts = await Promise.all([1, 2, 3, 4, 5].map(() => store.incrementOtpAttempts(otp.id)));
    expect([...counts].sort()).toEqual([1, 2, 3, 4, 5]);
    const wins = await Promise.all([store.consumeOtp(otp.id), store.consumeOtp(otp.id), store.consumeOtp(otp.id)]);
    expect(wins.filter(Boolean)).toHaveLength(1);
  });

  it('runs the full register-and-verify flow through the service on this store', async () => {
    const h = createHarness({ store });
    await h.service.register({ name: 'A', email: 'flow@x.com', password: 'a-good-password' });
    const user = await h.service.verifyEmail({ email: 'flow@x.com', code: h.lastCode() });
    expect(user).toMatchObject({ emailVerified: true, purgeAt: null });
    h.advance(61);
    await h.service.forgotPassword({ email: 'flow@x.com' });
    const reset = await h.service.resetPassword({ email: 'flow@x.com', code: h.lastCode(), newPassword: 'another-good-password' });
    expect(reset.tokenVersion).toBe(1);
    await expect(h.service.login({ email: 'flow@x.com', password: 'another-good-password' })).resolves.toBeTruthy();
  });
});

describe.skipIf(!MONGO_TEST_URL)('MongoDB-only guarantees', () => {
  it('rejects two users with the same Google id', async () => {
    await Promise.all([User.deleteMany({}), Otp.deleteMany({})]);
    const store = createMongoStore();
    await store.createUser({ email: 'a@x.com', name: 'A', googleId: 'dup', emailVerified: true });
    const err = await store.createUser({ email: 'b@x.com', name: 'B', googleId: 'dup', emailVerified: true }).catch((e) => e);
    expect(err.code).toBe(11000);
  });

  it('has a TTL index on otps.expiresAt and users.purgeAt, and a unique index on users.email', async () => {
    const otpIndexes = await Otp.collection.indexes();
    const userIndexes = await User.collection.indexes();
    expect(otpIndexes.some((i) => i.key.expiresAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
    expect(userIndexes.some((i) => i.key.purgeAt === 1 && i.expireAfterSeconds === 0)).toBe(true);
    expect(userIndexes.some((i) => i.key.email === 1 && i.unique)).toBe(true);
  });
});
