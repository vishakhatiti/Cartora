import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';
import { fakeCommerce } from '../test/fakeCommerce.js';
import { ApiError } from '../lib/api.js';
import { timing } from './PaymentReturnPage.jsx';

const signedIn = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }) });
const session = (over) => ({ session: { id: 's1', status: 'pending', items: [], totalCents: 1000, orderId: null, payment: { provider: 'stripe', demo: false, label: null }, ...over } });
const order = { id: 'o1', orderNumber: 'CRT-TEST', status: 'paid', items: [], subtotalCents: 1000, shippingCents: 0, totalCents: 1000, currency: 'USD', shippingAddress: { name: 'A', line1: 'x', city: 'y', state: 'z', postalCode: '1', country: 'IN' }, payment: { provider: 'stripe', demo: false }, paidAt: '2026-10-24T10:00:00.000Z', createdAt: '2026-10-24T10:00:00.000Z' };

beforeEach(() => { timing.pollMs = 20; timing.giveUpMs = 300; });

describe('payment return page', () => {
  it('waits for the server, not for the browser redirect, then opens the order', async () => {
    const getSession = vi.fn()
      .mockResolvedValueOnce(session({ status: 'pending' }))
      .mockResolvedValue(session({ status: 'succeeded', orderId: 'o1' }));
    const commerce = fakeCommerce({ getSession, getOrder: vi.fn().mockResolvedValue({ order }) });
    renderApp({ route: '/checkout/return/s1', api: signedIn(), commerce });
    expect(await screen.findByText('Confirming your payment…')).toBeInTheDocument();
    expect(await screen.findByText('Order CRT-TEST', { exact: false })).toBeInTheDocument();
    expect(getSession.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(screen.queryByText(/demo/i)).not.toBeInTheDocument(); // a Stripe order never says demo
  });

  it('shows the reason when the payment failed, and keeps the cart', async () => {
    const commerce = fakeCommerce({ getSession: vi.fn().mockResolvedValue(session({ status: 'failed', failureReason: 'An item sold out while you were paying. You were not charged.' })) });
    renderApp({ route: '/checkout/return/s1', api: signedIn(), commerce });
    expect(await screen.findByRole('alert')).toHaveTextContent('sold out while you were paying');
    expect(screen.getByRole('link', { name: 'Back to cart' })).toBeInTheDocument();
  });

  it('says it is still confirming, without claiming success, when the server never settles', async () => {
    const commerce = fakeCommerce({ getSession: vi.fn().mockResolvedValue(session({ status: 'pending' })) });
    renderApp({ route: '/checkout/return/s1', api: signedIn(), commerce });
    expect(await screen.findByRole('heading', { name: 'Still confirming' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'View my orders' })).toBeInTheDocument();
  });

  it('keeps trying through a network error and handles an unknown checkout', async () => {
    const getSession = vi.fn().mockRejectedValueOnce(new ApiError(0, 'NETWORK', 'offline')).mockResolvedValue(session({ status: 'failed', failureReason: 'Declined.' }));
    renderApp({ route: '/checkout/return/s1', api: signedIn(), commerce: fakeCommerce({ getSession }) });
    expect(await screen.findByRole('alert')).toHaveTextContent('Declined.');
  });

  it('shows not found for a checkout that is not yours', async () => {
    const commerce = fakeCommerce({ getSession: vi.fn().mockRejectedValue(new ApiError(404, 'NOT_FOUND', 'x')) });
    renderApp({ route: '/checkout/return/zzz', api: signedIn(), commerce });
    expect(await screen.findByRole('heading', { name: 'Checkout not found' })).toBeInTheDocument();
  });

  it('sends guests to sign in', async () => {
    renderApp({ route: '/checkout/return/s1' });
    expect(await screen.findByRole('heading', { name: /sign in/i })).toBeInTheDocument();
  });
});
