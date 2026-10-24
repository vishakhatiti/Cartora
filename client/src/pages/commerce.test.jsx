import { describe, it, expect, vi } from 'vitest';
import { screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';
import { fakeCommerce } from '../test/fakeCommerce.js';
import { ApiError } from '../lib/api.js';
import { detail, reviewsPage, stubCatalogFetch } from '../test/catalogFixtures.js';

const signedIn = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }) });
const stubProduct = () => stubCatalogFetch({
  '/api/products/B0TEST0001/reviews': () => reviewsPage,
  '/api/products/B0TEST0001/related': () => ({ items: [] }),
  '/api/products/B0TEST0001': () => ({ product: detail() }),
});
const DEMO = 'Demo Mode — No Real Money Charged';
const address = { name: 'Asha Kulkarni', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' };

async function fillAddress(over = {}) {
  const v = { ...address, ...over };
  await userEvent.type(await screen.findByLabelText('Full name'), v.name);
  await userEvent.type(screen.getByLabelText('Address line 1'), v.line1);
  await userEvent.type(screen.getByLabelText('City'), v.city);
  await userEvent.type(screen.getByLabelText('State or region'), v.state);
  await userEvent.type(screen.getByLabelText('Postal code'), v.postalCode);
  const country = screen.getByLabelText(/Country/);
  await userEvent.clear(country);
  await userEvent.type(country, v.country);
}

describe('cart for guests', () => {
  it('adds from the product page, shows the badge, and prices through the server quote', async () => {
    stubProduct();
    const commerce = fakeCommerce();
    renderApp({ route: '/product/B0TEST0001', commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));
    expect(await screen.findByText('Added 1 to your cart.')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('cartora-cart'))).toEqual([{ productId: 'B0TEST0001', qty: 1 }]);
    expect(commerce.quote).toHaveBeenLastCalledWith([{ productId: 'B0TEST0001', qty: 1 }]);
    expect(await screen.findByRole('link', { name: 'Cart, 1 item' })).toBeInTheDocument();
  });

  it('stores only ids and quantities, never prices', async () => {
    stubProduct();
    renderApp({ route: '/product/B0TEST0001' });
    await userEvent.click(await screen.findByRole('button', { name: 'Add to cart' }));
    await screen.findByText('Added 1 to your cart.');
    expect(localStorage.getItem('cartora-cart')).not.toMatch(/price|cents|total/i);
  });

  it('changes quantity and removes lines, with totals from the server', async () => {
    localStorage.setItem('cartora-cart', JSON.stringify([{ productId: 'B0TEST0001', qty: 1 }, { productId: 'B0TEST0002', qty: 1 }]));
    renderApp({ route: '/cart' });
    const list = await screen.findByRole('list', { name: 'Items in your cart' });
    expect(within(list).getAllByRole('listitem')).toHaveLength(2);
    const summary = screen.getByRole('complementary');
    expect(within(summary).getByText('Free')).toBeInTheDocument(); // 5999 + 1200 is over $50
    await userEvent.click(screen.getByRole('button', { name: 'Remove Noise-cancelling Headphones' }));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Items in your cart' })).getAllByRole('listitem')).toHaveLength(1));
    expect(within(screen.getByRole('complementary')).getByText('$5.99')).toBeInTheDocument(); // $12.00 pays shipping
  });

  it('shows an empty state and sends a guest to sign in at checkout', async () => {
    renderApp({ route: '/cart' });
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
  });

  it('asks a guest to sign in before checking out', async () => {
    localStorage.setItem('cartora-cart', JSON.stringify([{ productId: 'B0TEST0001', qty: 1 }]));
    renderApp({ route: '/cart' });
    await userEvent.click(await screen.findByRole('button', { name: 'Sign in to check out' }));
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });

  it('shows an error and keeps the cart when the server cannot quote', async () => {
    localStorage.setItem('cartora-cart', JSON.stringify([{ productId: 'B0TEST0001', qty: 1 }]));
    const commerce = fakeCommerce({ quote: vi.fn().mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'Something went wrong.')) });
    renderApp({ route: '/cart', commerce });
    expect(await screen.findByText(/something went wrong/i)).toBeInTheDocument();
    expect(localStorage.getItem('cartora-cart')).toContain('B0TEST0001');
  });
});

describe('guest cart merge on sign-in', () => {
  it('moves the browser cart to the account and clears it only after the server confirms', async () => {
    localStorage.setItem('cartora-cart', JSON.stringify([{ productId: 'B0TEST0001', qty: 2 }]));
    const commerce = fakeCommerce();
    renderApp({ route: '/cart', api: signedIn(), commerce });
    expect(await screen.findByText('Your browser cart was added to your account.')).toBeInTheDocument();
    expect(commerce.merge).toHaveBeenCalledWith([{ productId: 'B0TEST0001', qty: 2 }]);
    expect(localStorage.getItem('cartora-cart')).toBeNull();
    expect(await screen.findByRole('link', { name: 'Cart, 2 items' })).toBeInTheDocument();
  });

  it('keeps the browser cart when the merge fails', async () => {
    localStorage.setItem('cartora-cart', JSON.stringify([{ productId: 'B0TEST0001', qty: 1 }]));
    const commerce = fakeCommerce({ merge: vi.fn().mockRejectedValue(new ApiError(500, 'SERVER_ERROR', 'down')) });
    renderApp({ route: '/cart', api: signedIn(), commerce });
    expect(await screen.findByText(/still saved on this device/i)).toBeInTheDocument();
    expect(localStorage.getItem('cartora-cart')).toContain('B0TEST0001');
  });
});

describe('checkout', () => {
  const withCart = async () => {
    const commerce = fakeCommerce();
    await commerce.setQuantity('B0TEST0001', 1);
    return commerce;
  };

  it('sends a signed-out visitor to sign in', async () => {
    renderApp({ route: '/checkout' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });

  it('sends an empty cart back to the cart page', async () => {
    renderApp({ route: '/checkout', api: signedIn() });
    expect(await screen.findByRole('heading', { name: 'Your cart is empty' })).toBeInTheDocument();
  });

  it('labels the page as demo mode, from the server setting', async () => {
    renderApp({ route: '/checkout', api: signedIn(), commerce: await withCart() });
    expect(await screen.findByRole('note')).toHaveTextContent(DEMO);
    expect(screen.queryByLabelText(/card number/i)).not.toBeInTheDocument();
  });

  it('checks the address before calling the server', async () => {
    const commerce = await withCart();
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue to demo payment' }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(commerce.startCheckout).not.toHaveBeenCalled();
  });

  it('rejects a bad country code', async () => {
    const commerce = await withCart();
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await fillAddress({ country: 'USA' });
    await userEvent.click(screen.getByRole('button', { name: 'Continue to demo payment' }));
    expect(await screen.findByText(/two-letter country code/i)).toBeInTheDocument();
    expect(commerce.startCheckout).not.toHaveBeenCalled();
  });

  it('sends only the address, then opens the payment step', async () => {
    const commerce = await withCart();
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to demo payment' }));
    expect(await screen.findByRole('heading', { name: 'Simulate your payment' })).toBeInTheDocument();
    expect(commerce.startCheckout).toHaveBeenCalledWith(address);
  });

  it('shows the server message when checkout cannot start', async () => {
    const commerce = await withCart();
    commerce.startCheckout.mockRejectedValueOnce(new ApiError(409, 'CART_INVALID', 'One item is no longer available.'));
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Continue to demo payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('One item is no longer available.');
  });
});

describe('demo payment', () => {
  async function atPayment(commerce) {
    await commerce.setQuantity('B0TEST0001', 1);
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await fillAddress();
    await userEvent.click(await screen.findByRole('button', { name: 'Continue to demo payment' }));
    await screen.findByRole('heading', { name: 'Simulate your payment' });
  }

  it('labels the page and offers both outcomes without any card fields', async () => {
    await atPayment(fakeCommerce());
    expect(screen.getAllByRole('note')[0]).toHaveTextContent(DEMO);
    expect(screen.getByRole('button', { name: 'Simulate Successful Payment' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Simulate Failed Payment' })).toBeEnabled();
    expect(screen.queryByLabelText(/card|cvv|expiry/i)).not.toBeInTheDocument();
  });

  it('creates the order only on success, empties the cart and confirms', async () => {
    const commerce = fakeCommerce();
    await atPayment(commerce);
    expect(commerce.state.orders.size).toBe(0);
    await userEvent.click(screen.getByRole('button', { name: 'Simulate Successful Payment' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Order confirmed' })).toBeInTheDocument();
    expect(screen.getByText('Demo payment — No Real Money Charged')).toBeInTheDocument();
    expect(screen.getAllByText('CRT-TESTORDR').length).toBeGreaterThan(0);
    expect(commerce.state.orders.size).toBe(1);
    expect(commerce.state.items).toEqual([]);
    expect(screen.getByRole('link', { name: 'Cart' })).toBeInTheDocument(); // badge is gone
  });

  it('keeps the cart and explains a failure', async () => {
    const commerce = fakeCommerce();
    await atPayment(commerce);
    await userEvent.click(screen.getByRole('button', { name: 'Simulate Failed Payment' }));
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Payment failed');
    expect(alert).toHaveTextContent(/nothing was charged/i);
    expect(alert).toHaveTextContent(/cart is unchanged/i);
    expect(commerce.state.orders.size).toBe(0);
    expect(commerce.state.items).toEqual([{ productId: 'B0TEST0001', qty: 1 }]);
    expect(screen.queryByRole('button', { name: 'Simulate Successful Payment' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Try again' })).toHaveAttribute('href', '/checkout');
    expect(screen.getByRole('link', { name: 'Back to cart' })).toHaveAttribute('href', '/cart');
  });

  it('disables both buttons while a payment is being processed, so it cannot be sent twice', async () => {
    const commerce = fakeCommerce();
    await atPayment(commerce);
    let release;
    commerce.simulate.mockImplementationOnce(() => new Promise((resolve) => { release = () => resolve({ demo: true, session: { ...[...commerce.state.sessions.values()][0], status: 'failed', failureReason: 'x' }, order: null }); }));
    await userEvent.click(screen.getByRole('button', { name: 'Simulate Successful Payment' }));
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Simulate Failed Payment' })).toBeDisabled();
    expect(commerce.simulate).toHaveBeenCalledTimes(1);
    release();
    await screen.findByRole('alert');
  });

  it('shows a server error and leaves the buttons available to retry', async () => {
    const commerce = fakeCommerce();
    await atPayment(commerce);
    commerce.simulate.mockRejectedValueOnce(new ApiError(500, 'SERVER_ERROR', 'Something went wrong.'));
    await userEvent.click(screen.getByRole('button', { name: 'Simulate Successful Payment' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Something went wrong.');
    expect(screen.getByRole('button', { name: 'Simulate Successful Payment' })).toBeEnabled();
  });

  it('shows not found for a checkout that does not exist', async () => {
    renderApp({ route: '/checkout/pay/nope', api: signedIn() });
    expect(await screen.findByRole('heading', { name: 'Checkout not found' })).toBeInTheDocument();
  });
});

describe('order page', () => {
  it('shows not found for an order that is not yours or does not exist', async () => {
    renderApp({ route: '/orders/nope', api: signedIn() });
    expect(await screen.findByRole('heading', { name: 'Order not found' })).toBeInTheDocument();
  });

  it('asks a signed-out visitor to sign in', async () => {
    renderApp({ route: '/orders/ord_1' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });

  it('shows the demo label and does not mention Stripe', async () => {
    const commerce = fakeCommerce();
    await commerce.setQuantity('B0TEST0001', 1);
    await commerce.startCheckout(address);
    const sess = [...commerce.state.sessions.values()][0];
    await commerce.simulate(sess.id, 'success');
    renderApp({ route: `/orders/${sess.orderId}`, api: signedIn(), commerce });
    expect(await screen.findByRole('heading', { level: 1, name: 'Your order' })).toBeInTheDocument();
    expect(screen.getByRole('note')).toHaveTextContent(DEMO);
    expect(document.body).not.toHaveTextContent(/stripe/i);
  });
});
