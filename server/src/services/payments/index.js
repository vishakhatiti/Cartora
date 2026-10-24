import { createDemoProvider } from './demoProvider.js';

/** Pick the payment provider from PAYMENT_PROVIDER. Stripe is not implemented yet, and saying so is deliberate. */
export function createPaymentProvider(env = {}) {
  const name = env.PAYMENT_PROVIDER ?? 'demo';
  if (name === 'demo') return createDemoProvider();
  throw new Error(`PAYMENT_PROVIDER "${name}" is not implemented yet. Use "demo" until Stripe is added.`);
}
