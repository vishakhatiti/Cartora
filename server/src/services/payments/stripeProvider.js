import Stripe from 'stripe';

const CHECKOUT_LIFETIME_SECONDS = 30 * 60; // Stripe's minimum is 30 minutes

/**
 * Stripe Checkout provider (hosted payment page). Cartora never sees card details.
 *
 * Same surface as the demo provider (name, isDemo, startCheckout) plus what a real processor needs:
 *   verifyEvent(rawBody, signature)   checks Stripe's signature and returns the parsed event, or throws
 *   refund(paymentIntentId, key)      used when a buyer paid but the item sold out in the meantime
 * `stripe` can be injected so tests never talk to the network.
 */
export function createStripeProvider({ secretKey, webhookSecret, appUrl, stripe = new Stripe(secretKey) }) {
  if (!webhookSecret) throw new Error('STRIPE_WEBHOOK_SECRET is required when PAYMENT_PROVIDER=stripe.');
  const base = String(appUrl).replace(/\/+$/, '');

  return {
    name: 'stripe',
    isDemo: false,
    label: null,

    async startCheckout(session) {
      const params = {
        mode: 'payment',
        client_reference_id: session.id,
        metadata: { cartoraSessionId: session.id },
        customer_email: session.buyerEmail,
        // Prices come from the server's priced session, never from the browser.
        line_items: session.items.map((i) => ({
          quantity: i.qty,
          price_data: { currency: session.currency.toLowerCase(), unit_amount: i.unitPriceCents, product_data: { name: String(i.title).slice(0, 250) } },
        })),
        success_url: `${base}/checkout/return/${encodeURIComponent(session.id)}`,
        cancel_url: `${base}/cart`,
        expires_at: Math.floor(Date.now() / 1000) + CHECKOUT_LIFETIME_SECONDS,
      };
      if (session.shippingCents > 0) {
        params.shipping_options = [{ shipping_rate_data: { type: 'fixed_amount', display_name: 'Standard shipping', fixed_amount: { amount: session.shippingCents, currency: session.currency.toLowerCase() } } }];
      }
      const created = await stripe.checkout.sessions.create(params, { idempotencyKey: `cartora-checkout-${session.id}` });
      return { redirect: { type: 'external', url: created.url } };
    },

    verifyEvent(rawBody, signature) {
      return stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
    },

    async refund(paymentIntentId, key) {
      return stripe.refunds.create({ payment_intent: paymentIntentId }, { idempotencyKey: `cartora-refund-${key}` });
    },
  };
}
