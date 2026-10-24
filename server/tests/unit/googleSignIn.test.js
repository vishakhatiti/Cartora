import { describe, it, expect } from 'vitest';
import { createHarness } from '../helpers/authHarness.js';
import { createGoogleVerifier } from '../../src/services/auth/googleVerifier.js';
import { AppError } from '../../src/utils/AppError.js';

const profile = (over = {}) => ({
  sub: 'google-sub-1', email: 'asha@example.com', emailVerified: true, name: 'Asha K', picture: 'https://lh3.googleusercontent.com/a.jpg', ...over,
});
const verifierFor = (p) => ({ verify: async () => p });

describe('googleSignIn', () => {
  it('creates a verified account without a password', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    const user = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    expect(user).toMatchObject({ email: 'asha@example.com', name: 'Asha K', emailVerified: true, googleId: 'google-sub-1' });
    expect(user.passwordHash).toBeNull();
    expect(h.service.publicUser(user).avatarUrl).toMatch(/^https:/);
  });

  it('signs the same person in again without making a second account', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    const a = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    const b = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    expect(b.id).toBe(a.id);
  });

  it('keeps working when the person changes their Google email (matched by Google id)', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    const a = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    const again = createHarness({ store: h.store, googleVerifier: verifierFor(profile({ email: 'new@example.com' })) });
    expect((await again.service.googleSignIn({ credential: 'x'.repeat(30) })).id).toBe(a.id);
  });

  it('links an existing verified password account and keeps its password', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    await h.service.register({ name: 'Asha', email: 'asha@example.com', password: 'a-good-password' });
    await h.service.verifyEmail({ email: 'asha@example.com', code: h.lastCode() });
    const user = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    expect(user.googleId).toBe('google-sub-1');
    expect(user.name).toBe('Asha'); // an existing name is not overwritten
    await expect(h.service.login({ email: 'asha@example.com', password: 'a-good-password' })).resolves.toBeTruthy();
  });

  it('removes a squatter\'s password when linking an account that was never verified', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    await h.service.register({ name: 'Attacker', email: 'asha@example.com', password: 'attackers-password' });
    const before = await h.store.findUserByEmail('asha@example.com');
    const user = await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    expect(user).toMatchObject({ id: before.id, emailVerified: true, passwordHash: null, tokenVersion: before.tokenVersion + 1, purgeAt: null });
    await expect(h.service.login({ email: 'asha@example.com', password: 'attackers-password' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('refuses an email already linked to a different Google account', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile()) });
    await h.service.googleSignIn({ credential: 'x'.repeat(30) });
    const other = createHarness({ store: h.store, googleVerifier: verifierFor(profile({ sub: 'someone-else' })) });
    await expect(other.service.googleSignIn({ credential: 'x'.repeat(30) })).rejects.toMatchObject({ code: 'GOOGLE_CONFLICT', statusCode: 409 });
  });

  it('rejects an unverified Google email and creates nothing', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile({ emailVerified: false })) });
    await expect(h.service.googleSignIn({ credential: 'x'.repeat(30) })).rejects.toMatchObject({ code: 'GOOGLE_EMAIL_UNVERIFIED' });
    expect(await h.store.findUserByEmail('asha@example.com')).toBeNull();
  });

  it('falls back to the email name part when Google gives no name', async () => {
    const h = createHarness({ googleVerifier: verifierFor(profile({ name: '' })) });
    expect((await h.service.googleSignIn({ credential: 'x'.repeat(30) })).name).toBe('asha');
  });

  it('answers 503 when Google sign-in is not configured', async () => {
    const h = createHarness();
    await expect(h.service.googleSignIn({ credential: 'x'.repeat(30) })).rejects.toMatchObject({ code: 'GOOGLE_NOT_CONFIGURED' });
  });
});

describe('createGoogleVerifier', () => {
  const ticket = (payload) => ({ getPayload: () => payload });

  it('checks the token against our client id and normalises the profile', async () => {
    let seen;
    const client = { verifyIdToken: async (arg) => { seen = arg; return ticket({ sub: 123, email: 'A@Example.com', email_verified: true, name: 'A', picture: 'https://x/y.jpg' }); } };
    const profile1 = await createGoogleVerifier('client-123', { client }).verify('tok');
    expect(seen).toEqual({ idToken: 'tok', audience: 'client-123' });
    expect(profile1).toEqual({ sub: '123', email: 'a@example.com', emailVerified: true, name: 'A', picture: 'https://x/y.jpg' });
  });

  it('turns any verification failure into a generic 401 without details', async () => {
    const client = { verifyIdToken: async () => { throw new Error('Wrong recipient, payload audience != requiredAudience'); } };
    const err = await createGoogleVerifier('client-123', { client }).verify('tok').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.statusCode).toBe(401);
    expect(err.message).not.toMatch(/audience/i);
  });

  it('only treats email_verified === true as verified and drops non-https pictures', async () => {
    const client = { verifyIdToken: async () => ticket({ sub: '1', email: 'a@x.com', email_verified: 'true', picture: 'http://insecure/x.jpg' }) };
    const p = await createGoogleVerifier('c', { client }).verify('tok');
    expect(p.emailVerified).toBe(false);
    expect(p.picture).toBeNull();
  });

  it('rejects a token without a subject or email, and refuses to run without a client id', async () => {
    const client = { verifyIdToken: async () => ticket({ email: 'a@x.com' }) };
    await expect(createGoogleVerifier('c', { client }).verify('tok')).rejects.toMatchObject({ statusCode: 401 });
    await expect(createGoogleVerifier('', { client }).verify('tok')).rejects.toMatchObject({ code: 'GOOGLE_NOT_CONFIGURED' });
  });
});
