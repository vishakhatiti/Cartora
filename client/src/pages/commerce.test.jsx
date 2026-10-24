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

describe('wishlist', () => {
  it('asks a guest to sign in instead of saving', async () => {
    stubProduct();
    renderApp({ route: '/product/B0TEST0001' });
    await userEvent.click(await screen.findByRole('button', { name: /Save .* to wishlist/ }));
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });

  it('saves after the server confirms, shows it on the wishlist page and can move it to the cart', async () => {
    stubProduct();
    const commerce = fakeCommerce();
    renderApp({ route: '/product/B0TEST0001', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: /Save .* to wishlist/ }));
    expect(await screen.findByText('Saved to your wishlist.')).toBeInTheDocument();
    expect(commerce.state.wishlist).toEqual(['B0TEST0001']);
    expect(screen.getByRole('button', { name: /Remove .* from wishlist/ })).toHaveAttribute('aria-pressed', 'true');
  });

  it('lists saved products and moves one to the cart', async () => {
    const commerce = fakeCommerce();
    await commerce.addWishlist('B0TEST0001');
    renderApp({ route: '/wishlist', api: signedIn(), commerce });
    const list = await screen.findByRole('list', { name: 'Saved products' });
    expect(within(list).getByText('Noise-cancelling Headphones')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Move to cart' }));
    expect(await screen.findByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument();
    expect(commerce.state.items).toEqual([{ productId: 'B0TEST0001', qty: 1 }]);
    expect(commerce.state.wishlist).toEqual([]);
  });

  it('shows an empty state and requires sign-in', async () => {
    renderApp({ route: '/wishlist', api: signedIn() });
    expect(await screen.findByRole('heading', { name: 'Nothing saved yet' })).toBeInTheDocument();
  });

  it('does not change the heart when the server refuses', async () => {
    stubProduct();
    const commerce = fakeCommerce({ addWishlist: vi.fn().mockRejectedValue(new ApiError(409, 'WISHLIST_FULL', 'Your wishlist is full.')) });
    renderApp({ route: '/product/B0TEST0001', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: /Save .* to wishlist/ }));
    expect(await screen.findByText('Your wishlist is full.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Save .* to wishlist/ })).toHaveAttribute('aria-pressed', 'false');
  });
});

describe('orders list', () => {
  it('shows an empty state', async () => {
    renderApp({ route: '/orders', api: signedIn() });
    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
  });

  it('lists orders with number, total and status, linking to the detail page', async () => {
    const commerce = fakeCommerce();
    await commerce.setQuantity('B0TEST0001', 1);
    await commerce.startCheckout(address);
    await commerce.simulate([...commerce.state.sessions.keys()][0], 'success');
    renderApp({ route: '/orders', api: signedIn(), commerce });
    const list = await screen.findByRole('list', { name: 'Orders' });
    expect(within(list).getByText('CRT-TESTORDR')).toBeInTheDocument();
    expect(within(list).getByText('$59.99')).toBeInTheDocument();
    expect(within(list).getByText('Paid')).toBeInTheDocument();
    expect(within(list).getByRole('link', { name: 'View order' })).toHaveAttribute('href', '/orders/ord_1');
  });

  it('asks a guest to sign in and shows a retryable error', async () => {
    renderApp({ route: '/orders' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });
});

describe('addresses', () => {
  it('adds, edits, defaults and removes addresses with server confirmation', async () => {
    const commerce = fakeCommerce();
    renderApp({ route: '/account/addresses', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await fillAddress();
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Address saved.')).toBeInTheDocument();
    expect(commerce.addAddress).toHaveBeenCalledWith(address, true);
    const list = screen.getByRole('list', { name: 'Saved addresses' });
    expect(within(list).getByText('Default')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Edit' }));
    const city = screen.getByLabelText('City');
    await userEvent.clear(city);
    await userEvent.type(city, 'Mumbai');
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Address updated.')).toBeInTheDocument();
    expect(commerce.state.addresses[0].city).toBe('Mumbai');
    await userEvent.click(screen.getByRole('button', { name: /Remove address 1 Main St/ }));
    expect(await screen.findByRole('heading', { name: 'No saved addresses' })).toBeInTheDocument();
  });

  it('validates before sending', async () => {
    const commerce = fakeCommerce();
    renderApp({ route: '/account/addresses', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Add an address' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save address' }));
    expect(await screen.findByText('Full name is required.')).toBeInTheDocument();
    expect(commerce.addAddress).not.toHaveBeenCalled();
  });

  it('prefills checkout from the default saved address', async () => {
    const commerce = fakeCommerce();
    await commerce.addAddress(address, true);
    await commerce.setQuantity('B0TEST0001', 1);
    renderApp({ route: '/checkout', api: signedIn(), commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Continue to demo payment' }));
    expect(await screen.findByRole('heading', { name: 'Simulate your payment' })).toBeInTheDocument();
    expect(commerce.startCheckout).toHaveBeenCalledWith(address);
  });

  it('shows the account hub with links to every buyer page', async () => {
    renderApp({ route: '/account', api: signedIn() });
    const tiles = await screen.findByRole('list', { name: 'Account pages' });
    for (const [name, href] of [['Your orders', '/orders'], ['Wishlist', '/wishlist'], ['Addresses', '/account/addresses'], ['Customer service', '/help'], ['Start selling', '/sell/start']]) {
      expect(within(tiles).getByRole('link', { name: new RegExp(name) })).toHaveAttribute('href', href);
    }
  });
});

describe('customer service', () => {
  it('shows honest answers, including that payments are simulated', async () => {
    renderApp({ route: '/help' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Customer service' })).toBeInTheDocument();
    expect(screen.getByText(/Demo Mode — No Real Money Charged/)).toBeInTheDocument();
    expect(screen.getByText(/Shipping is free when your subtotal is \$50\.00 or more/)).toBeInTheDocument();
  });

  it('validates, then sends a request and shows the reference number', async () => {
    const commerce = fakeCommerce();
    renderApp({ route: '/help', commerce });
    await userEvent.click(await screen.findByRole('button', { name: 'Send request' }));
    expect(await screen.findByText('Enter your name.')).toBeInTheDocument();
    expect(commerce.createTicket).not.toHaveBeenCalled();
    await userEvent.type(screen.getByLabelText('Your name'), 'Asha');
    await userEvent.type(screen.getByLabelText('Email'), 'asha@example.com');
    await userEvent.type(screen.getByLabelText('How can we help?'), 'My parcel has not arrived yet.');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('status')).toHaveTextContent('SUP-TESTTICK');
    expect(commerce.createTicket).toHaveBeenCalledWith(expect.objectContaining({ topic: 'order', email: 'asha@example.com' }));
  });

  it('shows the server message when sending fails', async () => {
    const commerce = fakeCommerce({ createTicket: vi.fn().mockRejectedValue(new ApiError(429, 'RATE_LIMITED', 'Too many requests. Please try again later.')) });
    renderApp({ route: '/help', api: signedIn(), commerce });
    await screen.findByRole('button', { name: /account menu/i });
    await userEvent.type(await screen.findByLabelText('How can we help?'), 'Please help me with this.');
    await userEvent.click(screen.getByRole('button', { name: 'Send request' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Too many requests.');
  });
});

describe('notification bell', () => {
  it('is hidden for guests', async () => {
    renderApp({ route: '/help' });
    await screen.findByRole('heading', { level: 1, name: 'Customer service' });
    expect(screen.queryByRole('button', { name: /^Notifications/ })).not.toBeInTheDocument();
  });

  it('shows the unread count, lists items and marks them read', async () => {
    const commerce = fakeCommerce();
    commerce.state.pushNotification({ type: 'order_paid', title: 'Order confirmed', message: 'Order CRT-ABCD2345 is confirmed.', link: '/orders/o1' });
    renderApp({ route: '/help', api: signedIn(), commerce });
    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' });
    await userEvent.click(bell);
    const dialog = screen.getByRole('dialog', { name: 'Notifications' });
    expect(within(dialog).getByRole('link', { name: /Order confirmed/ })).toHaveAttribute('href', '/orders/o1');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark all read' }));
    expect(await screen.findByRole('button', { name: 'Notifications' })).toBeInTheDocument();
    expect(commerce.markNotificationsRead).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state and closes with Escape', async () => {
    renderApp({ route: '/help', api: signedIn() });
    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    expect(screen.getByText('Nothing new yet.')).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});

describe('seller items on shopper pages', () => {
  const sellerProduct = (over = {}) => detail({ storeName: 'Asha Crafts', stockQty: 3, ...over });
  const stubSeller = (product) => stubCatalogFetch({
    '/api/products/B0TEST0001/reviews': () => reviewsPage, '/api/products/B0TEST0001/related': () => ({ items: [] }), '/api/products/B0TEST0001': () => ({ product: product }),
  });

  it('names the store and warns when stock is low', async () => {
    stubSeller(sellerProduct());
    renderApp({ route: '/product/B0TEST0001' });
    expect(await screen.findByText('Asha Crafts')).toBeInTheDocument();
    expect(screen.getByText('Only 3 left')).toBeInTheDocument();
  });

  it('disables buying when sold out', async () => {
    stubSeller(sellerProduct({ stockQty: 0 }));
    renderApp({ route: '/product/B0TEST0001' });
    expect(await screen.findByRole('button', { name: 'Out of stock' })).toBeDisabled();
    expect(screen.queryByRole('group', { name: 'Quantity to add' })).not.toBeInTheDocument();
  });

  it('shows per-item shipping progress on an order', async () => {
    const commerce = fakeCommerce();
    commerce.state.orders.set('o9', { id: 'o9', orderNumber: 'CRT-SHIPPED1', status: 'shipped', items: [{ productId: 'S1', title: 'Hand-made Mug', qty: 1, unitPriceCents: 2450, storeName: 'Asha Crafts', fulfilment: 'shipped', shippedAt: '2026-10-22T00:00:00.000Z' }], subtotalCents: 2450, shippingCents: 599, totalCents: 3049, payment: { demo: true }, shippingAddress: address, createdAt: '2026-10-20T00:00:00.000Z' });
    renderApp({ route: '/orders/o9', api: signedIn(), commerce });
    const progress = await screen.findByRole('list', { name: 'Shipping progress' });
    expect(progress).toHaveTextContent('Hand-made Mug from Asha Crafts: shipped on');
  });
});
