import { describe, it, expect } from 'vitest';
import { createPasswordHasher, DEFAULT_PARAMS } from '../../src/services/auth/passwords.js';
import { generateCode, createOtpHasher } from '../../src/services/auth/otp.js';
import { signSession, readSession, cookieOptions } from '../../src/services/auth/tokens.js';
import { buildRawMessage } from '../../src/services/mail/mime.js';
import { otpEmail } from '../../src/services/mail/templates.js';
import { createGmailMailer, createMailer } from '../../src/services/mail/mailer.js';
import { fastHasher, SECRET } from '../helpers/authHarness.js';

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await fastHasher.hash('correct horse');
    const b = await fastHasher.hash('correct horse');
    expect(a).not.toBe(b);
    expect(a.startsWith('scrypt$')).toBe(true);
    expect(await fastHasher.verify('correct horse', a)).toBe(true);
    expect(await fastHasher.verify('wrong', a)).toBe(false);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    for (const bad of [undefined, null, '', 'plaintext', 'bcrypt$1$2$3$4$5', 'scrypt$x$y$z$a$b']) {
      expect(await fastHasher.verify('x', bad)).toBe(false);
    }
  });

  it('uses the documented production cost', () => {
    expect(DEFAULT_PARAMS).toEqual({ N: 32768, r: 8, p: 3 });
  });

  it('still verifies a hash made with other parameters', async () => {
    const old = await createPasswordHasher({ N: 2 ** 9, r: 8, p: 1 }).hash('pw');
    expect(await fastHasher.verify('pw', old)).toBe(true);
  });
});

describe('one-time codes', () => {
  it('generates 6 digits, including leading zeros', () => {
    for (let i = 0; i < 200; i += 1) expect(generateCode()).toMatch(/^\d{6}$/);
  });

  it('binds a code to its email and purpose', () => {
    const otp = createOtpHasher(SECRET);
    const hash = otp.hash('a@x.com', 'login', '123456');
    expect(otp.matches('a@x.com', 'login', '123456', hash)).toBe(true);
    expect(otp.matches('a@x.com', 'login', '123457', hash)).toBe(false);
    expect(otp.matches('b@x.com', 'login', '123456', hash)).toBe(false);
    expect(otp.matches('a@x.com', 'reset_password', '123456', hash)).toBe(false);
    expect(otp.matches('a@x.com', 'login', '123456', 'not-hex')).toBe(false);
  });

  it('gives different hashes under a different secret and never contains the code', () => {
    const h1 = createOtpHasher(SECRET).hash('a@x.com', 'login', '123456');
    const h2 = createOtpHasher(`${SECRET}-other`).hash('a@x.com', 'login', '123456');
    expect(h1).not.toBe(h2);
    expect(h1).not.toContain('123456');
  });

  it('refuses to work without a secret', () => {
    expect(() => createOtpHasher('')).toThrow(/JWT_SECRET/);
  });
});

describe('session tokens', () => {
  const user = { id: 'u1', tokenVersion: 2 };

  it('round-trips and carries the token version', () => {
    expect(readSession(SECRET, signSession(SECRET, user))).toEqual({ userId: 'u1', tokenVersion: 2 });
  });

  it('rejects tampered, wrongly signed and garbage tokens', () => {
    const token = signSession(SECRET, user);
    expect(readSession(SECRET, `${token}x`)).toBeNull();
    expect(readSession('another-secret-that-is-long-enough-123456', token)).toBeNull();
    expect(readSession(SECRET, 'garbage')).toBeNull();
    expect(readSession(SECRET, undefined)).toBeNull();
  });

  it('rejects an unsigned (alg none) token', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    expect(readSession(SECRET, `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'u1', tv: 0 })}.`)).toBeNull();
  });

  it('sets safe cookie options and Secure only in production', () => {
    expect(cookieOptions({ NODE_ENV: 'production' })).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/' });
    expect(cookieOptions({ NODE_ENV: 'development' }).secure).toBe(false);
  });
});

describe('email building', () => {
  const decode = (raw) => Buffer.from(raw, 'base64url').toString('utf8');

  it('builds a multipart message with an encoded subject and base64 bodies', () => {
    const msg = decode(buildRawMessage({ from: 'Cartora <a@x.com>', to: 'b@x.com', subject: 'Héllo ✓', text: 'plain', html: '<b>hi</b>' }));
    expect(msg).toContain('To: b@x.com');
    expect(msg).toContain('multipart/alternative');
    expect(msg).toMatch(/Subject: =\?UTF-8\?B\?/);
    expect(msg).toContain(Buffer.from('plain').toString('base64'));
  });

  it('blocks header injection through the recipient or subject', () => {
    const base = { from: 'a@x.com', subject: 's', text: 't', html: 'h' };
    expect(() => buildRawMessage({ ...base, to: 'b@x.com\r\nBcc: evil@x.com' })).toThrow(/Invalid To/);
    expect(() => buildRawMessage({ ...base, to: 'b@x.com', from: 'a@x.com\nX: y' })).toThrow(/Invalid From/);
  });

  it('puts the code, expiry and a purpose-specific subject in the email', () => {
    const { subject, text, html } = otpEmail({ purpose: 'reset_password', code: '042917', minutes: 10 });
    expect(subject).toMatch(/Reset/);
    expect(text).toContain('Your code: 042917');
    expect(text).toContain('10 minutes');
    expect(html).toContain('042917');
  });
});

describe('mailer selection and Gmail sending', () => {
  const gmailEnv = { GOOGLE_CLIENT_ID: 'id', GOOGLE_CLIENT_SECRET: 's', GOOGLE_REFRESH_TOKEN: 'r', EMAIL_USER: 'shop@gmail.com' };

  it('sends through the Gmail API as the configured sender', async () => {
    const calls = [];
    const mailer = createGmailMailer({ ...gmailEnv, NODE_ENV: 'production' }, {
      gmailClient: { users: { messages: { send: async (arg) => { calls.push(arg); } } } },
    });
    await mailer.send({ to: 'b@x.com', subject: 'S', text: 't', html: 'h' });
    expect(calls[0].userId).toBe('me');
    expect(Buffer.from(calls[0].requestBody.raw, 'base64url').toString()).toContain('From: Cartora <shop@gmail.com>');
  });

  it('turns a Gmail failure into a 502 without leaking details to the client', async () => {
    const mailer = createGmailMailer(gmailEnv, {
      gmailClient: { users: { messages: { send: async () => { throw new Error('invalid_grant: secret detail'); } } } },
    });
    const err = await mailer.send({ to: 'b@x.com', subject: 'S', text: 't', html: 'h' }).catch((e) => e);
    expect(err.statusCode).toBe(502);
    expect(err.message).not.toContain('invalid_grant');
  });

  it('refuses to send in production when Gmail is not configured', async () => {
    const err = await createMailer({ NODE_ENV: 'production' }).send({ to: 'a@x.com' }).catch((e) => e);
    expect(err.statusCode).toBe(503);
    expect(err.code).toBe('EMAIL_NOT_CONFIGURED');
  });

  it('does not throw in test mode without credentials', async () => {
    await expect(createMailer({ NODE_ENV: 'test' }).send({ to: 'a@x.com', subject: 's', text: 't' })).resolves.toBeUndefined();
  });
});
