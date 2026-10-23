import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(5000);
    expect(env.FRONTEND_URL).toBe('http://localhost:5173');
    expect(env.MONGO_URL).toBeUndefined();
  });

  it('treats empty strings from .env.example as unset', () => {
    const env = parseEnv({ PORT: '', JWT_SECRET: '', MONGO_URL: '' });
    expect(env.PORT).toBe(5000);
    expect(env.JWT_SECRET).toBeUndefined();
  });

  it('coerces PORT to a number', () => {
    expect(parseEnv({ PORT: '8080' }).PORT).toBe(8080);
  });

  it('rejects a short secret without echoing its value', () => {
    const secret = 'tooShortSecretValue123';
    let message = '';
    try {
      parseEnv({ JWT_SECRET: secret });
    } catch (err) {
      message = err.message;
    }
    expect(message).toContain('JWT_SECRET');
    expect(message).not.toContain(secret);
  });

  it('rejects an invalid FRONTEND_URL', () => {
    expect(() => parseEnv({ FRONTEND_URL: 'not-a-url' })).toThrow(/FRONTEND_URL/);
  });

  it('requires core keys in production and lists their names', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/FRONTEND_URL.*MONGO_URL.*JWT_SECRET/s);
  });

  it('accepts a complete production configuration', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://cartora.vercel.app',
      MONGO_URL: 'mongodb+srv://u:p@cluster0.example.mongodb.net/cartora',
      JWT_SECRET: 'a'.repeat(32),
    });
    expect(env.NODE_ENV).toBe('production');
  });

  it('rejects a MONGO_URL that is not a mongodb connection string, without echoing it', () => {
    const bad = 'https://user:topsecretpw@example.com/db';
    let message = '';
    try {
      parseEnv({ MONGO_URL: bad });
    } catch (err) {
      message = err.message;
    }
    expect(message).toContain('MONGO_URL');
    expect(message).not.toContain('topsecretpw');
  });
});
