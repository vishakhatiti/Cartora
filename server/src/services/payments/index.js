import { createDemoProvider } from './demoProvider.js';
import { createStripeProvider } from './stripeProvider.js';

/** Pick the payment provider from PAYMENT_PROVIDER. "demo" is the default and moves no money. */
export function createPaymentProvider(env = {}) {
  const name = env.PAYMENT_PROVIDER ?? 'demo';
  if (name === 'demo') return createDemoProvider();
  if (name === 'stripe') {
    if (!env.STRIPE_SECRET_KEY) throw new Error('STRIPE_SECRET_KEY is required when PAYMENT_PROVIDER=stripe.');
    return createStripeProvider({ secretKey: env.STRIPE_SECRET_KEY, webhookSecret: env.STRIPE_WEBHOOK_SECRET, appUrl: env.FRONTEND_URL });
  }
  throw new Error(`Unknown PAYMENT_PROVIDER "${name}". Use "demo" or "stripe".`);
}
