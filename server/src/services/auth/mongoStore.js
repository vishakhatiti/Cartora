import { User } from '../../models/User.js';
import { Otp } from '../../models/Otp.js';

const toUser = (doc) =>
  doc && {
    id: String(doc._id),
    email: doc.email,
    name: doc.name,
    passwordHash: doc.passwordHash ?? null,
    emailVerified: Boolean(doc.emailVerified),
    isSeller: Boolean(doc.isSeller),
    storeName: doc.storeName ?? null,
    tokenVersion: doc.tokenVersion ?? 0,
    lastLoginAt: doc.lastLoginAt ?? null,
    purgeAt: doc.purgeAt ?? null,
  };

const toOtp = (doc) =>
  doc && {
    id: String(doc._id),
    email: doc.email,
    purpose: doc.purpose,
    codeHash: doc.codeHash,
    attempts: doc.attempts,
    consumedAt: doc.consumedAt ?? null,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };

const isValidId = (id) => /^[a-f0-9]{24}$/i.test(String(id));

/** MongoDB implementation of the auth store. Atomic updates keep attempt counting and single use safe. */
export function createMongoStore() {
  return {
    async findUserByEmail(email) {
      return toUser(await User.findOne({ email }).select('+passwordHash').lean());
    },
    async findUserById(id) {
      if (!isValidId(id)) return null;
      return toUser(await User.findById(id).select('+passwordHash').lean());
    },
    async createUser({ email, name, passwordHash = null, emailVerified = false, purgeAt = null }) {
      const doc = await User.create({ email, name, passwordHash: passwordHash ?? undefined, emailVerified, purgeAt: purgeAt ?? undefined });
      return toUser(doc.toObject());
    },
    async updateUser(id, { set = {}, unset = [], incTokenVersion = false } = {}) {
      if (!isValidId(id)) return null;
      const update = {};
      if (Object.keys(set).length) update.$set = set;
      if (unset.length) update.$unset = Object.fromEntries(unset.map((k) => [k, 1]));
      if (incTokenVersion) update.$inc = { tokenVersion: 1 };
      const doc = await User.findByIdAndUpdate(id, update, { returnDocument: 'after', runValidators: true })
        .select('+passwordHash').lean();
      return toUser(doc);
    },

    async replaceOtp({ email, purpose, codeHash, expiresAt }) {
      await Otp.deleteMany({ email, purpose });
      const doc = await Otp.create({ email, purpose, codeHash, expiresAt });
      return toOtp(doc.toObject());
    },
    async findActiveOtp(email, purpose, now = new Date()) {
      return toOtp(await Otp.findOne({ email, purpose, consumedAt: { $exists: false }, expiresAt: { $gt: now } }).lean());
    },
    async findLatestOtp(email, purpose) {
      return toOtp(await Otp.findOne({ email, purpose }).sort({ createdAt: -1 }).lean());
    },
    async incrementOtpAttempts(id) {
      const doc = await Otp.findByIdAndUpdate(id, { $inc: { attempts: 1 } }, { returnDocument: 'after' }).lean();
      return doc ? doc.attempts : null;
    },
    async consumeOtp(id, now = new Date()) {
      const result = await Otp.updateOne({ _id: id, consumedAt: { $exists: false } }, { $set: { consumedAt: now } });
      return result.modifiedCount === 1;
    },
  };
}
