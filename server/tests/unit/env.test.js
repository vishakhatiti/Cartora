import { describe, it, expect } from 'vitest';
import { parseEnv, buildMongoUri } from '../../src/config/env.js';

describe('parseEnv', () => {
  it('applies defaults when nothing is set', () => {
    const env = parseEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.PORT).toBe(5000);
    expect(env.CLIENT_URL).toBe('http://localhost:5173');
    expect(env.MONGODB_DB_NAME).toBe('cartora');
  });

  it('treats empty strings from .env.example as unset', () => {
    const env = parseEnv({ PORT: '', JWT_SECRET: '', MONGODB_USER: '' });
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

  it('rejects an invalid CLIENT_URL', () => {
    expect(() => parseEnv({ CLIENT_URL: 'not-a-url' })).toThrow(/CLIENT_URL/);
  });

  it('requires core keys in production and lists their names', () => {
    expect(() => parseEnv({ NODE_ENV: 'production' })).toThrow(/MONGODB_USER.*JWT_SECRET/s);
  });

  it('accepts a complete production configuration', () => {
    const env = parseEnv({
      NODE_ENV: 'production',
      MONGODB_USER: 'u',
      MONGODB_PASSWORD: 'p',
      MONGODB_HOST: 'cluster0.example.mongodb.net',
      JWT_SECRET: 'a'.repeat(32),
      OTP_PEPPER: 'b'.repeat(32),
    });
    expect(env.NODE_ENV).toBe('production');
  });
});

describe('buildMongoUri', () => {
  it('url-encodes special characters in the credentials', () => {
    const uri = buildMongoUri({
      MONGODB_USER: 'user',
      MONGODB_PASSWORD: 'p@ss:w/rd',
      MONGODB_HOST: 'cluster0.example.mongodb.net',
      MONGODB_DB_NAME: 'cartora',
    });
    expect(uri).toBe(
      'mongodb+srv://user:p%40ss%3Aw%2Frd@cluster0.example.mongodb.net/cartora?retryWrites=true&w=majority',
    );
  });

  it('returns null when any connection part is missing', () => {
    expect(buildMongoUri({ MONGODB_USER: 'u', MONGODB_HOST: 'h', MONGODB_DB_NAME: 'cartora' })).toBeNull();
    expect(buildMongoUri({ MONGODB_DB_NAME: 'cartora' })).toBeNull();
  });
});
