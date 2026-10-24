import { randomUUID } from 'node:crypto';

/**
 * In-memory implementation of the auth store. Used by tests and by the contract tests that make sure
 * it behaves like the MongoDB store. Same method names and return shapes as mongoStore.js.
 */
export function createMemoryStore() {
  const users = new Map();
  let otps = [];

  const copy = (user) => (user ? { ...user } : null);

  return {
    async findUserByEmail(email) {
      return copy([...users.values()].find((u) => u.email === email));
    },
    async findUserById(id) {
      return copy(users.get(id));
    },
    async createUser({ email, name, passwordHash = null, emailVerified = false, purgeAt = null }) {
      if ([...users.values()].some((u) => u.email === email)) {
        const err = new Error('duplicate');
        err.code = 'DUPLICATE';
        throw err;
      }
      const user = {
        id: randomUUID(), email, name, passwordHash, emailVerified, purgeAt,
        isSeller: false, storeName: null, tokenVersion: 0, lastLoginAt: null,
      };
      users.set(user.id, user);
      return copy(user);
    },
    async updateUser(id, { set = {}, unset = [], incTokenVersion = false } = {}) {
      const user = users.get(id);
      if (!user) return null;
      Object.assign(user, set);
      for (const key of unset) user[key] = null;
      if (incTokenVersion) user.tokenVersion += 1;
      return copy(user);
    },

    async replaceOtp({ email, purpose, codeHash, expiresAt, now = new Date() }) {
      otps = otps.filter((o) => !(o.email === email && o.purpose === purpose));
      const otp = { id: randomUUID(), email, purpose, codeHash, expiresAt, attempts: 0, consumedAt: null, createdAt: now };
      otps.push(otp);
      return { ...otp };
    },
    async findActiveOtp(email, purpose, now = new Date()) {
      const otp = otps.find((o) => o.email === email && o.purpose === purpose && !o.consumedAt && o.expiresAt > now);
      return otp ? { ...otp } : null;
    },
    /** Latest code of any state, for the resend cooldown. */
    async findLatestOtp(email, purpose) {
      const otp = otps.find((o) => o.email === email && o.purpose === purpose);
      return otp ? { ...otp } : null;
    },
    async incrementOtpAttempts(id) {
      const otp = otps.find((o) => o.id === id);
      if (!otp) return null;
      otp.attempts += 1;
      return otp.attempts;
    },
    /** True only for the single caller that actually consumed the code. */
    async consumeOtp(id, now = new Date()) {
      const otp = otps.find((o) => o.id === id);
      if (!otp || otp.consumedAt) return false;
      otp.consumedAt = now;
      return true;
    },
  };
}
