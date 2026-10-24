import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';
import { ApiError } from '../lib/api.js';
import { apiError, stubCatalogFetch } from '../test/catalogFixtures.js';

const customer = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }) });
const seller = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: { ...asha, isSeller: true, storeName: 'Asha Crafts' } }) });
const summary = (over = {}) => ({ summary: { store: { name: 'Asha Crafts' }, products: { total: 0, active: 0, outOfStock: 0 }, orders: { total: 0, toShip: 0, shipped: 0 }, salesCents: 0, demoOrders: 0, ...over } });
const modeSwitch = () => within(screen.getByRole('group', { name: 'Account mode' }));

describe('buying and selling switch', () => {
  it('is in the header for everyone and marks the current mode', async () => {
    stubCatalogFetch();
    renderApp({ route: '/' });
    expect(modeSwitch().getByRole('link', { name: 'Buying' })).toHaveAttribute('aria-current', 'true');
    expect(modeSwitch().getByRole('link', { name: 'Selling' })).toHaveAttribute('href', '/sell');
  });

  it('sends a guest who picks Selling to sign in', async () => {
    stubCatalogFetch();
    renderApp({ route: '/' });
    await userEvent.click(modeSwitch().getByRole('link', { name: 'Selling' }));
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
  });

  it('sends a signed-in customer to seller set-up', async () => {
    stubCatalogFetch();
    renderApp({ route: '/', api: customer() });
    await screen.findByRole('button', { name: /account menu/i });
    await userEvent.click(modeSwitch().getByRole('link', { name: 'Selling' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Start selling on Cartora' })).toBeInTheDocument();
  });
});

describe('seller set-up', () => {
  it('activates the account only after the server confirms, then opens the dashboard', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => summary() });
    const api = customer();
    renderApp({ route: '/sell/start', api });
    await userEvent.type(await screen.findByLabelText('Store name'), '  Asha Crafts ');
    await userEvent.click(screen.getByRole('button', { name: 'Activate seller account' }));
    expect(api.becomeSeller).toHaveBeenCalledWith('Asha Crafts');
    expect(await screen.findByRole('heading', { level: 1, name: 'Seller dashboard' })).toBeInTheDocument();
    expect(await screen.findByText('Your seller account is ready.')).toBeInTheDocument();
    expect(modeSwitch().getByRole('link', { name: 'Selling' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByText(/Seller workspace · Asha Crafts/)).toBeInTheDocument();
  });

  it('shows the server message and stays on the form when activation fails', async () => {
    stubCatalogFetch();
    const api = fakeApi({
      me: vi.fn().mockResolvedValue({ user: asha }),
      becomeSeller: vi.fn().mockRejectedValue(new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email before you start selling.')),
    });
    renderApp({ route: '/sell/start', api });
    await userEvent.type(await screen.findByLabelText('Store name'), 'Asha Crafts');
    await userEvent.click(screen.getByRole('button', { name: 'Activate seller account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Verify your email before you start selling.');
    expect(screen.getByRole('button', { name: 'Activate seller account' })).toBeEnabled();
    expect(screen.queryByText('Your seller account is ready.')).not.toBeInTheDocument();
  });

  it('checks the store name before calling the server', async () => {
    stubCatalogFetch();
    const api = customer();
    renderApp({ route: '/sell/start', api });
    await userEvent.type(await screen.findByLabelText('Store name'), 'A');
    await userEvent.click(screen.getByRole('button', { name: 'Activate seller account' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('at least 2 characters');
    expect(api.becomeSeller).not.toHaveBeenCalled();
  });

  it('does not offer set-up to guests, and skips it for existing sellers', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => summary() });
    const { unmount } = renderApp({ route: '/sell/start' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
    unmount();
    renderApp({ route: '/sell/start', api: seller() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Seller dashboard' })).toBeInTheDocument();
  });
});

describe('seller dashboard', () => {
  it('redirects guests to sign in and customers to set-up', async () => {
    stubCatalogFetch();
    const { unmount } = renderApp({ route: '/sell' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
    unmount();
    renderApp({ route: '/sell', api: customer() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Start selling on Cartora' })).toBeInTheDocument();
  });

  it('shows the store from the server and invites the first product when there is nothing yet', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => summary() });
    renderApp({ route: '/sell', api: seller() });
    expect(await screen.findByText('Store: Asha Crafts')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Add your first product' })).toBeInTheDocument();
    expect(screen.getByText(/no sales figures yet because there are no sales/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a product' })).toHaveAttribute('href', '/sell/products/new');
  });

  it('sends the user to set-up if the server says they are not a seller', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => apiError(403, 'SELLER_REQUIRED', 'This area is for seller accounts.') });
    renderApp({ route: '/sell', api: seller() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Start selling on Cartora' })).toBeInTheDocument();
  });
});


describe('seller workspace', () => {
  const listing = (over = {}) => ({ id: 'S1', title: 'Hand-made Mug', brand: 'Asha', category: { slug: 'electronics', label: 'Electronics' }, priceCents: 2450, stockQty: 3, description: 'A mug.', features: ['Dishwasher safe'], images: [{ thumb: 'https://i.example.com/a.jpg', large: 'https://i.example.com/a.jpg' }], isActive: true, createdAt: '2026-10-01T00:00:00.000Z', ...over });

  it('shows real figures and flags demo sales', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => summary({ products: { total: 4, active: 3, outOfStock: 1 }, orders: { total: 2, toShip: 1, shipped: 1 }, salesCents: 4900, demoOrders: 2 }) });
    renderApp({ route: '/sell', api: seller() });
    const tiles = await screen.findByRole('list', { name: 'Store figures' });
    expect(within(tiles).getByText('$49.00')).toBeInTheDocument();
    expect(within(tiles).getByText(/Includes 2 demo orders: Demo Mode — No Real Money Charged/)).toBeInTheDocument();
    expect(within(tiles).getByRole('link', { name: /Orders to ship/ })).toHaveAttribute('href', '/sell/orders');
  });

  it('has a workspace navigation in the header while selling', async () => {
    stubCatalogFetch({ '/api/seller/summary': () => summary() });
    renderApp({ route: '/sell', api: seller() });
    const nav = await screen.findByRole('navigation', { name: 'Seller workspace' });
    for (const [name, href] of [['Dashboard', '/sell'], ['My products', '/sell/products'], ['Add product', '/sell/products/new'], ['Orders', '/sell/orders']]) {
      expect(within(nav).getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  it('keeps customers and guests out of the seller pages', async () => {
    stubCatalogFetch();
    const { unmount } = renderApp({ route: '/sell/products' });
    expect(await screen.findByRole('heading', { name: /welcome back|sign in/i })).toBeInTheDocument();
    unmount();
    renderApp({ route: '/sell/orders', api: customer() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Start selling on Cartora' })).toBeInTheDocument();
  });

  it('lists products and hides one after the server confirms', async () => {
    let active = true;
    stubCatalogFetch({
      '/api/seller/products': (url) => (url.pathname.endsWith('/S1') ? { product: listing({ isActive: false }) } : { products: [listing({ isActive: active })] }),
    });
    const fetchSpy = globalThis.fetch;
    renderApp({ route: '/sell/products', api: seller() });
    const list = await screen.findByRole('list', { name: 'Your products' });
    expect(within(list).getByText('Hand-made Mug')).toBeInTheDocument();
    expect(within(list).getByText(/3 in stock/)).toBeInTheDocument();
    expect(within(list).getByText('Live')).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Hide Hand-made Mug' }));
    expect(await screen.findByText('Product hidden from shoppers.')).toBeInTheDocument();
    expect(within(list).getByText('Hidden')).toBeInTheDocument();
    const put = fetchSpy.mock.calls.find(([u, init]) => String(u).endsWith('/api/seller/products/S1') && init?.method === 'PUT');
    expect(JSON.parse(put[1].body)).toEqual({ isActive: false });
    active = false;
  });

  it('checks the form, then publishes a product and returns to the list', async () => {
    const spy = stubCatalogFetch({ '/api/seller/products': (url) => (url.pathname.endsWith('/products') ? { products: [] } : {}) });
    renderApp({ route: '/sell/products/new', api: seller() });
    await userEvent.click(await screen.findByRole('button', { name: 'Publish product' }));
    expect(await screen.findByText('Title needs at least 3 characters.')).toBeInTheDocument();
    expect(screen.getByText('Choose a category.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one image link.')).toBeInTheDocument();
    expect(spy.mock.calls.some(([, init]) => init?.method === 'POST')).toBe(false);

    await userEvent.type(screen.getByLabelText('Title'), 'Hand-made Mug');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'electronics');
    await userEvent.type(screen.getByLabelText('Price (USD)'), '24.50');
    await userEvent.type(screen.getByLabelText(/Image links/), 'http://insecure.example.com/a.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Publish product' }));
    expect(await screen.findByText('Every image link must start with https://')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/Image links/));
    await userEvent.type(screen.getByLabelText(/Image links/), 'https://images.example.com/mug.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Publish product' }));
    expect(await screen.findByText('Product published. Shoppers can find it now.')).toBeInTheDocument();
    const post = spy.mock.calls.find(([, init]) => init?.method === 'POST');
    expect(JSON.parse(post[1].body)).toMatchObject({ title: 'Hand-made Mug', category: 'electronics', price: 24.5, stockQty: 1, imageUrls: ['https://images.example.com/mug.jpg'] });
  });

  it('shows the server message when publishing fails', async () => {
    stubCatalogFetch({ '/api/seller/products': (url) => apiError(400, 'VALIDATION_ERROR', 'Choose one of the listed categories.') });
    renderApp({ route: '/sell/products/new', api: seller() });
    await userEvent.type(await screen.findByLabelText('Title'), 'Hand-made Mug');
    await userEvent.selectOptions(await screen.findByLabelText('Category'), 'electronics');
    await userEvent.type(screen.getByLabelText('Price (USD)'), '5');
    await userEvent.type(screen.getByLabelText(/Image links/), 'https://images.example.com/mug.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Publish product' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Choose one of the listed categories.');
  });

  it('loads a product into the edit form', async () => {
    stubCatalogFetch({ '/api/seller/products': () => ({ products: [listing()] }) });
    renderApp({ route: '/sell/products/S1', api: seller() });
    expect(await screen.findByLabelText('Title')).toHaveValue('Hand-made Mug');
    expect(screen.getByLabelText('Price (USD)')).toHaveValue('24.50');
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeInTheDocument();
  });

  it('lists orders with the ship-to address and marks one shipped after the server confirms', async () => {
    const order = { id: 'o1', orderNumber: 'CRT-ABCD2345', createdAt: '2026-10-20T00:00:00.000Z', subtotalCents: 4900, payment: { demo: true }, fulfilment: 'pending', shippingAddress: { name: 'Buyer', line1: '1 Main St', city: 'Pune', state: 'MH', postalCode: '411001', country: 'IN' }, items: [{ productId: 'S1', title: 'Hand-made Mug', qty: 2, unitPriceCents: 2450, fulfilment: 'pending' }] };
    stubCatalogFetch({ '/api/seller/orders': (url) => (url.pathname.endsWith('/ship') ? { order: { ...order, fulfilment: 'shipped' } } : { orders: [order] }) });
    renderApp({ route: '/sell/orders', api: seller() });
    const list = await screen.findByRole('list', { name: 'Seller orders' });
    expect(within(list).getByText('CRT-ABCD2345')).toBeInTheDocument();
    expect(within(list).getByText(/Ship to:/).parentElement).toHaveTextContent('Buyer, 1 Main St, Pune, MH 411001, IN');
    expect(within(list).getByText(/Demo payment — No Real Money Charged/)).toBeInTheDocument();
    await userEvent.click(within(list).getByRole('button', { name: 'Mark order CRT-ABCD2345 as shipped' }));
    expect(await screen.findByText('Order CRT-ABCD2345 marked as shipped.')).toBeInTheDocument();
    expect(within(list).getByText('Shipped')).toBeInTheDocument();
  });

  it('shows an empty state for orders', async () => {
    stubCatalogFetch({ '/api/seller/orders': () => ({ orders: [] }) });
    renderApp({ route: '/sell/orders', api: seller() });
    expect(await screen.findByRole('heading', { name: 'No orders yet' })).toBeInTheDocument();
  });
});
