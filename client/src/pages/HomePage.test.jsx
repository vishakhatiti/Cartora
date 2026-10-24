import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp.jsx';
import { stubCatalogFetch } from '../test/catalogFixtures.js';

describe('home page', () => {
  it('renders the landing content, categories, products and the live API status', async () => {
    stubCatalogFetch();
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shop smarter.');
    const cats = await screen.findByRole('link', { name: /Electronics/ });
    expect(cats).toHaveAttribute('href', '/products?category=electronics');
    expect(await screen.findByRole('link', { name: /Noise-cancelling Headphones/ })).toHaveAttribute('href', '/product/B0TEST0001');
    expect(await screen.findByText('API online · Database connected')).toBeInTheDocument();
  });

  it('has landmark regions, a skip link and a search box', async () => {
    stubCatalogFetch();
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Search products' })).toBeInTheDocument();
    await screen.findByText('API online · Database connected');
  });

  it('shows an error with a retry button when the catalog cannot load', async () => {
    stubCatalogFetch({ '/api/products': () => ({ __error: true, status: 500, code: 'ERROR', message: 'Server error.' }) });
    renderApp();
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    await screen.findByText('API online · Database connected');
  });

  it('shows a 404 page for unknown addresses', async () => {
    stubCatalogFetch();
    renderApp({ route: '/nope' });
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
