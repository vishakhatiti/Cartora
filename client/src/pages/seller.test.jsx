import { describe, it, expect, vi } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';
import { ApiError } from '../lib/api.js';
import { apiError, stubCatalogFetch } from '../test/catalogFixtures.js';

const customer = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }) });
const seller = () => fakeApi({ me: vi.fn().mockResolvedValue({ user: { ...asha, isSeller: true, storeName: 'Asha Crafts' } }) });
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
    stubCatalogFetch({ '/api/seller/me': () => ({ store: { name: 'Asha Crafts' } }) });
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
    stubCatalogFetch({ '/api/seller/me': () => ({ store: { name: 'Asha Crafts' } }) });
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

  it('shows the store from the server and makes no sales claims', async () => {
    stubCatalogFetch({ '/api/seller/me': () => ({ store: { name: 'Asha Crafts' } }) });
    renderApp({ route: '/sell', api: seller() });
    expect(await screen.findByText('Store: Asha Crafts')).toBeInTheDocument();
    expect(screen.getByText(/no sales records/)).toBeInTheDocument();
  });

  it('sends the user to set-up if the server says they are not a seller', async () => {
    stubCatalogFetch({ '/api/seller/me': () => apiError(403, 'SELLER_REQUIRED', 'This area is for seller accounts.') });
    renderApp({ route: '/sell', api: seller() });
    expect(await screen.findByRole('heading', { level: 1, name: 'Start selling on Cartora' })).toBeInTheDocument();
  });
});
