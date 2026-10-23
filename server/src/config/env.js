import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  CLIENT_URL: z.url().default('http://localhost:5173'),

  MONGODB_USER: z.string().optional(),
  MONGODB_PASSWORD: z.string().optional(),
  MONGODB_HOST: z.string().optional(),
  MONGODB_DB_NAME: z.string().default('cartora'),

  JWT_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),
  OTP_PEPPER: z.string().min(32, 'must be at least 32 characters').optional(),
  GOOGLE_SIGNIN_CLIENT_ID: z.string().optional(),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_SENDER_ADDRESS: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

// Keys that must be present before the server may start in production.
const REQUIRED_IN_PRODUCTION = [
  'MONGODB_USER',
  'MONGODB_PASSWORD',
  'MONGODB_HOST',
  'JWT_SECRET',
  'OTP_PEPPER',
];

/**
 * Validate environment variables. Error messages contain key names only, never values.
 * Empty strings (as in .env.example) are treated as "not set".
 */
export function parseEnv(source = process.env) {
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== undefined && value !== ''),
  );
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const problems = result.error.issues.map((i) => `${i.path.join('.') || 'env'}: ${i.message}`);
    throw new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
  }
  const env = result.data;
  if (env.NODE_ENV === 'production') {
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !env[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  return env;
}

/** Build the MongoDB Atlas connection string from its parts. Returns null if parts are missing. */
export function buildMongoUri(env) {
  const { MONGODB_USER, MONGODB_PASSWORD, MONGODB_HOST, MONGODB_DB_NAME } = env;
  if (!MONGODB_USER || !MONGODB_PASSWORD || !MONGODB_HOST) return null;
  const user = encodeURIComponent(MONGODB_USER);
  const password = encodeURIComponent(MONGODB_PASSWORD);
  return `mongodb+srv://${user}:${password}@${MONGODB_HOST}/${MONGODB_DB_NAME}?retryWrites=true&w=majority`;
}

export const env = parseEnv();
