export const DEMO_LABEL = 'Demo Mode — No Real Money Charged';

/**
 * Demo payment provider. It moves no money and talks to no payment company. It exists so the whole
 * checkout can be built and tested before Stripe is available.
 *
 * A provider has the same small surface as a real one will:
 *   name, isDemo, label        what is shown to the buyer and recorded on the order
 *   startCheckout(session)     returns where the buyer goes to pay: { redirect: { type, path | url } }
 * With Stripe, startCheckout creates a Stripe Checkout Session and returns { type: 'external', url }, and
 * the verified webhook calls checkoutService.completeSession(...), exactly as the demo "simulate" route does.
 */
export function createDemoProvider() {
  return {
    name: 'demo',
    isDemo: true,
    label: DEMO_LABEL,
    async startCheckout(session) {
      return { redirect: { type: 'internal', path: `/checkout/pay/${session.id}` } };
    },
  };
}
