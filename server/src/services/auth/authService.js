import { AppError } from '../../utils/AppError.js';
import { OTP_TTL_MINUTES, OTP_MAX_ATTEMPTS } from '../../models/Otp.js';
import { generateCode, createOtpHasher } from './otp.js';
import { otpEmail } from '../mail/templates.js';

export const RESEND_COOLDOWN_SECONDS = 60;
const UNVERIFIED_KEEP_DAYS = 3;
const GENERIC_BAD_CODE = 'That code is incorrect or has expired. Request a new one.';

/**
 * All sign-in rules in one place. Dependencies are passed in so tests can use an in-memory store and a
 * fake mailer.
 *
 * Email enumeration: requests that send a code answer the same way whether or not the account exists,
 * and a wrong password and an unknown email give the same error.
 */
export function createAuthService({ store, mailer, hasher, secret, googleVerifier = null, now = () => new Date() }) {
  // Built on first use so the app still starts in development without JWT_SECRET (auth routes then answer 503).
  let otpHasher;
  const otp = {
    hash: (...args) => (otpHasher ??= createOtpHasher(secret)).hash(...args),
    matches: (...args) => (otpHasher ??= createOtpHasher(secret)).matches(...args),
  };

  // A real hash to compare against when the email is unknown, so timing does not reveal accounts.
  let dummyHash;
  const dummyVerify = async (password) => {
    dummyHash ??= await hasher.hash('not-a-real-password');
    await hasher.verify(password, dummyHash);
  };

  const publicUser = (u) => ({
    id: u.id, email: u.email, name: u.name, emailVerified: u.emailVerified,
    isSeller: u.isSeller, storeName: u.storeName, avatarUrl: u.avatarUrl ?? null,
  });

  /**
   * Emails a fresh code. Within the cooldown nothing is sent. The cooldown is silent (not an error) because
   * an error would only appear for real accounts and reveal which emails are registered.
   */
  async function sendCode(email, purpose) {
    const latest = await store.findLatestOtp(email, purpose);
    if (latest && (now() - latest.createdAt) / 1000 < RESEND_COOLDOWN_SECONDS) return;
    const code = generateCode();
    const expiresAt = new Date(now().getTime() + OTP_TTL_MINUTES * 60 * 1000);
    await store.replaceOtp({ email, purpose, codeHash: otp.hash(email, purpose, code), expiresAt, now: now() });
    await mailer.send({ to: email, ...otpEmail({ purpose, code, minutes: OTP_TTL_MINUTES }) });
  }

  /**
   * Checks a code. Each wrong guess is counted atomically before comparing, so parallel guesses cannot
   * exceed the limit, and a correct code can be used only once.
   */
  async function checkCode(email, purpose, code) {
    const active = await store.findActiveOtp(email, purpose, now());
    if (!active) throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
    const attempts = await store.incrementOtpAttempts(active.id);
    if (attempts === null || attempts > OTP_MAX_ATTEMPTS) {
      throw new AppError(429, 'Too many wrong attempts. Request a new code.', 'OTP_LOCKED');
    }
    if (!otp.matches(email, purpose, code, active.codeHash)) {
      throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
    }
    if (!(await store.consumeOtp(active.id, now()))) {
      throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
    }
  }

  async function markLoggedIn(user) {
    return (await store.updateUser(user.id, { set: { lastLoginAt: now() } })) ?? user;
  }

  return {
    publicUser,

    /** Creates an unverified account (or refreshes an unverified one) and emails a code. */
    async register({ name, email, password }) {
      const existing = await store.findUserByEmail(email);
      if (existing?.emailVerified) return; // same answer as success; the owner can use "forgot password"
      const passwordHash = await hasher.hash(password);
      const purgeAt = new Date(now().getTime() + UNVERIFIED_KEEP_DAYS * 24 * 60 * 60 * 1000);
      if (existing) {
        await store.updateUser(existing.id, { set: { name, passwordHash, purgeAt } });
      } else {
        try {
          await store.createUser({ email, name, passwordHash, purgeAt });
        } catch (err) {
          if (err.code !== 'DUPLICATE' && err.code !== 11000) throw err; // a parallel request created it
        }
      }
      await sendCode(email, 'verify_email');
    },

    async resendVerification({ email }) {
      const user = await store.findUserByEmail(email);
      if (user && !user.emailVerified) await sendCode(email, 'verify_email');
    },

    async verifyEmail({ email, code }) {
      await checkCode(email, 'verify_email', code);
      const user = await store.findUserByEmail(email);
      if (!user) throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
      const updated = await store.updateUser(user.id, {
        set: { emailVerified: true, lastLoginAt: now() },
        unset: ['purgeAt'],
      });
      return updated;
    },

    async login({ email, password }) {
      const user = await store.findUserByEmail(email);
      const valid = user?.passwordHash ? await hasher.verify(password, user.passwordHash) : (await dummyVerify(password), false);
      if (!user || !valid) throw new AppError(401, 'Incorrect email or password.', 'INVALID_CREDENTIALS');
      if (!user.emailVerified) {
        throw new AppError(403, 'Please verify your email first. We can send a new code.', 'EMAIL_NOT_VERIFIED');
      }
      return markLoggedIn(user);
    },

    async requestLoginCode({ email }) {
      const user = await store.findUserByEmail(email);
      if (user?.emailVerified) await sendCode(email, 'login');
    },

    async verifyLoginCode({ email, code }) {
      await checkCode(email, 'login', code);
      const user = await store.findUserByEmail(email);
      if (!user?.emailVerified) throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
      return markLoggedIn(user);
    },

    /**
     * Signs in with a Google ID token. Google proves the person controls the mailbox, so:
     *  - a known Google id signs straight in;
     *  - an existing account with the same email is linked;
     *  - if that account was never verified, any password on it was set by whoever registered first, so it is
     *    removed and old sessions are revoked (this stops "pre-registration" account takeover);
     *  - otherwise a new verified account without a password is created.
     */
    async googleSignIn({ credential }) {
      if (!googleVerifier) throw new AppError(503, 'Google sign-in is not configured on the server.', 'GOOGLE_NOT_CONFIGURED');
      const profile = await googleVerifier.verify(credential);
      if (!profile.emailVerified) {
        throw new AppError(401, 'Your Google email address is not verified.', 'GOOGLE_EMAIL_UNVERIFIED');
      }

      const bySub = await store.findUserByGoogleId(profile.sub);
      if (bySub) return markLoggedIn(bySub);

      const byEmail = await store.findUserByEmail(profile.email);
      if (byEmail) {
        if (byEmail.googleId && byEmail.googleId !== profile.sub) {
          throw new AppError(409, 'This email is already linked to a different Google account.', 'GOOGLE_CONFLICT');
        }
        const wasUnverified = !byEmail.emailVerified;
        return store.updateUser(byEmail.id, {
          set: {
            googleId: profile.sub, emailVerified: true, lastLoginAt: now(),
            ...(profile.picture && !byEmail.avatarUrl && { avatarUrl: profile.picture }),
            ...(wasUnverified && { passwordHash: null }),
          },
          unset: ['purgeAt'],
          incTokenVersion: wasUnverified,
        });
      }

      const name = (profile.name || profile.email.split('@')[0]).slice(0, 80);
      try {
        return await store.createUser({
          email: profile.email, name, emailVerified: true, googleId: profile.sub, avatarUrl: profile.picture,
        });
      } catch (err) {
        if (err.code !== 'DUPLICATE' && err.code !== 11000) throw err;
        return markLoggedIn((await store.findUserByGoogleId(profile.sub)) ?? (await store.findUserByEmail(profile.email)));
      }
    },

    async forgotPassword({ email }) {
      const user = await store.findUserByEmail(email);
      if (user) await sendCode(email, 'reset_password');
    },

    /** Sets a new password and signs out every older session. Proving the mailbox also verifies the email. */
    async resetPassword({ email, code, newPassword }) {
      await checkCode(email, 'reset_password', code);
      const user = await store.findUserByEmail(email);
      if (!user) throw new AppError(400, GENERIC_BAD_CODE, 'OTP_INVALID');
      const passwordHash = await hasher.hash(newPassword);
      return store.updateUser(user.id, {
        set: { passwordHash, emailVerified: true, lastLoginAt: now() },
        unset: ['purgeAt'],
        incTokenVersion: true,
      });
    },

    /** Loads the user for a session token, rejecting tokens issued before a password reset. */
    async userForSession({ userId, tokenVersion }) {
      const user = await store.findUserById(userId);
      if (!user || !user.emailVerified || user.tokenVersion !== tokenVersion) return null;
      return user;
    },
  };
}
