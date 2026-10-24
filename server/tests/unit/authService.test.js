import { describe, it, expect } from 'vitest';
import { createHarness, SECRET } from '../helpers/authHarness.js';
import { createOtpHasher } from '../../src/services/auth/otp.js';

const PW = 'a-good-password';
const person = { name: 'Asha', email: 'asha@example.com', password: PW };

async function registered(h) {
  await h.service.register(person);
  const code = h.lastCode();
  await h.service.verifyEmail({ email: person.email, code });
  h.advance(61);
  return h.store.findUserByEmail(person.email);
}

describe('register and verify email', () => {
  it('creates an unverified account with a purge date and emails a code', async () => {
    const h = createHarness();
    await h.service.register(person);
    const user = await h.store.findUserByEmail(person.email);
    expect(user.emailVerified).toBe(false);
    expect(user.passwordHash).not.toContain(PW);
    expect(user.purgeAt).toBeInstanceOf(Date);
    expect(h.outbox).toHaveLength(1);
    expect(h.outbox[0].to).toBe(person.email);
    expect(h.lastCode()).toMatch(/^\d{6}$/);
  });

  it('verifies with the right code, clears the purge date and allows login', async () => {
    const h = createHarness();
    const user = await registered(h);
    expect(user.emailVerified).toBe(true);
    expect(user.purgeAt).toBeNull();
    const loggedIn = await h.service.login({ email: person.email, password: PW });
    expect(loggedIn.email).toBe(person.email);
  });

  it('does nothing visible for an already verified email (no second account, no email)', async () => {
    const h = createHarness();
    await registered(h);
    const before = h.outbox.length;
    await h.service.register({ ...person, name: 'Intruder', password: 'attackers-password' });
    expect(h.outbox).toHaveLength(before);
    expect((await h.store.findUserByEmail(person.email)).name).toBe('Asha');
    await expect(h.service.login({ email: person.email, password: 'attackers-password' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('lets an unverified sign-up be retried with a new code', async () => {
    const h = createHarness();
    await h.service.register(person);
    h.advance(61);
    await h.service.register({ ...person, name: 'Asha K' });
    expect(h.outbox).toHaveLength(2);
    await h.service.verifyEmail({ email: person.email, code: h.lastCode() });
    expect((await h.store.findUserByEmail(person.email)).name).toBe('Asha K');
  });

  it('blocks login until the email is verified, after checking the password', async () => {
    const h = createHarness();
    await h.service.register(person);
    await expect(h.service.login({ email: person.email, password: PW })).rejects.toMatchObject({ code: 'EMAIL_NOT_VERIFIED' });
    await expect(h.service.login({ email: person.email, password: 'wrong-password' })).rejects.toMatchObject({ code: 'INVALID_CREDENTIALS' });
  });
});

describe('code rules', () => {
  it('rejects a wrong code, and the correct code still works afterwards', async () => {
    const h = createHarness();
    await h.service.register(person);
    const good = h.lastCode();
    const bad = good === '000000' ? '000001' : '000000';
    await expect(h.service.verifyEmail({ email: person.email, code: bad })).rejects.toMatchObject({ code: 'OTP_INVALID' });
    await expect(h.service.verifyEmail({ email: person.email, code: good })).resolves.toMatchObject({ emailVerified: true });
  });

  it('locks after 5 attempts even if the 6th is correct', async () => {
    const h = createHarness();
    await h.service.register(person);
    const good = h.lastCode();
    const bad = good === '000000' ? '000001' : '000000';
    for (let i = 0; i < 5; i += 1) {
      await expect(h.service.verifyEmail({ email: person.email, code: bad })).rejects.toMatchObject({ code: 'OTP_INVALID' });
    }
    await expect(h.service.verifyEmail({ email: person.email, code: good })).rejects.toMatchObject({ code: 'OTP_LOCKED', statusCode: 429 });
  });

  it('accepts the correct code on the 5th attempt', async () => {
    const h = createHarness();
    await h.service.register(person);
    const good = h.lastCode();
    const bad = good === '000000' ? '000001' : '000000';
    for (let i = 0; i < 4; i += 1) await h.service.verifyEmail({ email: person.email, code: bad }).catch(() => {});
    await expect(h.service.verifyEmail({ email: person.email, code: good })).resolves.toBeTruthy();
  });

  it('expires after 10 minutes', async () => {
    const h = createHarness();
    await h.service.register(person);
    const code = h.lastCode();
    h.advance(10 * 60 + 1);
    await expect(h.service.verifyEmail({ email: person.email, code })).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('works just before the 10 minute mark', async () => {
    const h = createHarness();
    await h.service.register(person);
    const code = h.lastCode();
    h.advance(10 * 60 - 1);
    await expect(h.service.verifyEmail({ email: person.email, code })).resolves.toBeTruthy();
  });

  it('can be used only once', async () => {
    const h = createHarness();
    await h.service.register(person);
    const code = h.lastCode();
    await h.service.verifyEmail({ email: person.email, code });
    await expect(h.service.verifyEmail({ email: person.email, code })).rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('lets only one of two parallel uses of the same code succeed', async () => {
    const h = createHarness();
    await h.service.register(person);
    const code = h.lastCode();
    const results = await Promise.allSettled([
      h.service.verifyEmail({ email: person.email, code }),
      h.service.verifyEmail({ email: person.email, code }),
    ]);
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  });

  it('invalidates the previous code when a new one is sent', async () => {
    const h = createHarness();
    await h.service.register(person);
    const first = h.lastCode();
    h.advance(61);
    await h.service.resendVerification({ email: person.email });
    const second = h.lastCode();
    if (first !== second) {
      await expect(h.service.verifyEmail({ email: person.email, code: first })).rejects.toBeTruthy();
    }
    await expect(h.service.verifyEmail({ email: person.email, code: second })).resolves.toBeTruthy();
  });

  it('does not send another code within the 60 second cooldown, and gives no hint about it', async () => {
    const h = createHarness();
    await h.service.register(person);
    await expect(h.service.resendVerification({ email: person.email })).resolves.toBeUndefined();
    expect(h.outbox).toHaveLength(1);
    h.advance(61);
    await h.service.resendVerification({ email: person.email });
    expect(h.outbox).toHaveLength(2);
  });

  it('does not accept a code issued for a different purpose', async () => {
    const h = createHarness();
    await registered(h);
    await h.service.requestLoginCode({ email: person.email });
    const loginCode = h.lastCode();
    await expect(h.service.resetPassword({ email: person.email, code: loginCode, newPassword: 'brand-new-password' }))
      .rejects.toMatchObject({ code: 'OTP_INVALID' });
  });

  it('stores only a keyed hash, never the code', async () => {
    const h = createHarness();
    await h.service.register(person);
    const code = h.lastCode();
    const stored = await h.store.findActiveOtp(person.email, 'verify_email', new Date('2026-01-01T00:00:01Z'));
    expect(stored.codeHash).not.toContain(code);
    expect(stored.codeHash).toBe(createOtpHasher(SECRET).hash(person.email, 'verify_email', code));
  });
});

describe('login by emailed code', () => {
  it('signs in a verified user', async () => {
    const h = createHarness();
    await registered(h);
    await h.service.requestLoginCode({ email: person.email });
    const user = await h.service.verifyLoginCode({ email: person.email, code: h.lastCode() });
    expect(user.email).toBe(person.email);
  });

  it('sends nothing for unknown or unverified emails, and answers the same', async () => {
    const h = createHarness();
    await expect(h.service.requestLoginCode({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    await h.service.register(person);
    h.advance(61);
    const before = h.outbox.length;
    await expect(h.service.requestLoginCode({ email: person.email })).resolves.toBeUndefined();
    expect(h.outbox).toHaveLength(before);
  });
});

describe('forgot and reset password', () => {
  it('resets the password, signs out old sessions and verifies the email', async () => {
    const h = createHarness();
    const before = await registered(h);
    await h.service.forgotPassword({ email: person.email });
    const user = await h.service.resetPassword({ email: person.email, code: h.lastCode(), newPassword: 'a-brand-new-password' });
    expect(user.tokenVersion).toBe(before.tokenVersion + 1);
    await expect(h.service.login({ email: person.email, password: PW })).rejects.toMatchObject({ statusCode: 401 });
    await expect(h.service.login({ email: person.email, password: 'a-brand-new-password' })).resolves.toBeTruthy();
    expect(await h.service.userForSession({ userId: before.id, tokenVersion: before.tokenVersion })).toBeNull();
    expect(await h.service.userForSession({ userId: before.id, tokenVersion: user.tokenVersion })).toBeTruthy();
  });

  it('answers the same for unknown emails and sends nothing', async () => {
    const h = createHarness();
    await expect(h.service.forgotPassword({ email: 'nobody@example.com' })).resolves.toBeUndefined();
    expect(h.outbox).toHaveLength(0);
  });
});

describe('login', () => {
  it('gives the same error for a wrong password and an unknown email', async () => {
    const h = createHarness();
    await registered(h);
    const a = await h.service.login({ email: person.email, password: 'wrong-password' }).catch((e) => e);
    const b = await h.service.login({ email: 'nobody@example.com', password: 'wrong-password' }).catch((e) => e);
    expect(a.statusCode).toBe(401);
    expect({ ...b }).toEqual({ ...a });
    expect(b.message).toBe(a.message);
  });

  it('rejects password login for an account without a password', async () => {
    const h = createHarness();
    await h.store.createUser({ email: 'g@example.com', name: 'G', emailVerified: true });
    await expect(h.service.login({ email: 'g@example.com', password: 'anything-at-all' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('never returns the password hash in the public user', async () => {
    const h = createHarness();
    const user = await registered(h);
    expect(h.service.publicUser(user)).not.toHaveProperty('passwordHash');
    expect(h.service.publicUser(user)).not.toHaveProperty('tokenVersion');
  });
});
