import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(5000),
  FRONTEND_URL: z.url().default('http://localhost:5173'),

  // Full Atlas connection string, including the database name, for example
  // mongodb+srv://USER:PASSWORD@cluster0.abcde.mongodb.net/cartora?retryWrites=true&w=majority
  MONGO_URL: z
    .string()
    .regex(/^mongodb(\+srv)?:\/\//, 'must start with mongodb:// or mongodb+srv://')
    .optional(),

  JWT_SECRET: z.string().min(32, 'must be at least 32 characters').optional(),

  // One Google OAuth client is used for Google sign-in and for sending mail through the Gmail API.
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REFRESH_TOKEN: z.string().optional(),
  // The Gmail address that sends OTP and order emails (the account the refresh token belongs to).
  EMAIL_USER: z.string().optional(),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

// Keys that must be present before the server may start in production.
const REQUIRED_IN_PRODUCTION = ['FRONTEND_URL', 'MONGO_URL', 'JWT_SECRET'];

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
    // Check the raw input: a default (such as localhost for FRONTEND_URL) must not count as configured.
    const missing = REQUIRED_IN_PRODUCTION.filter((key) => !cleaned[key]);
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  }
  return env;
}

export const env = parseEnv();
