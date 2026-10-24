import express from 'express';

/**
 * POST /api/webhooks/stripe. The only way a Stripe payment marks an order paid.
 * Mounted BEFORE express.json() because the signature is computed over the exact raw bytes.
 * Answers 400 for a bad signature (Stripe will not retry that) and 5xx for our own failures (Stripe retries).
 */
export function createStripeWebhookRouter({ checkout, log = console }) {
  const router = express.Router();
  const { provider } = checkout;

  router.post('/', express.raw({ type: 'application/json', limit: '1mb' }), async (req, res) => {
    let event;
    try {
      event = provider.verifyEvent(req.body, req.get('stripe-signature'));
    } catch {
      return res.status(400).json({ error: { code: 'BAD_SIGNATURE', message: 'Invalid signature.' } });
    }

    try {
      const obj = event.data?.object ?? {};
      const sessionId = obj.client_reference_id || obj.metadata?.cartoraSessionId;
      const paid = obj.payment_status === 'paid';

      if (['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(event.type) && sessionId && paid) {
        const result = await checkout.confirmExternalPayment(sessionId, { amountCents: obj.amount_total, currency: obj.currency });
        if (!result.order && result.session.status === 'failed' && obj.payment_intent) {
          // The buyer paid, but stock ran out first. Give the money back.
          await provider.refund(obj.payment_intent, sessionId);
          log.warn?.(`Refunded session ${sessionId}: item sold out after payment.`);
        }
      } else if (['checkout.session.expired', 'checkout.session.async_payment_failed'].includes(event.type) && sessionId) {
        await checkout.completeSession(sessionId, { outcome: 'failed', reason: 'The payment was not completed.' });
      }
      return res.json({ received: true });
    } catch (err) {
      if (err.statusCode && err.statusCode < 500) {
        // A payment we refuse to act on (unknown session, amount mismatch). Retrying cannot help, so acknowledge and log.
        log.error?.(`Stripe event ${event.id} ignored: ${err.code ?? err.message}`);
        return res.json({ received: true, ignored: true });
      }
      log.error?.(`Stripe event ${event.id} failed: ${err.message}`);
      return res.status(500).json({ error: { code: 'WEBHOOK_FAILED', message: 'Could not process the event.' } });
    }
  });

  return router;
}
