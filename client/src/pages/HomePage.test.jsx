import { describe, it, expect } from 'vitest';
import { screen, within } from '@testing-library/react';
import { renderApp } from '../test/renderApp.jsx';
import { stubCatalogFetch } from '../test/catalogFixtures.js';

describe('home page', () => {
  it('renders the landing content, categories, and the Trending, Best sellers and New releases shelves', async () => {
    stubCatalogFetch();
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shop smarter.');
    const cats = await within(screen.getByRole('main')).findByRole('link', { name: /Electronics/ });
    expect(cats).toHaveAttribute('href', '/products?category=electronics');
    for (const [name, path] of [['Trending now', '/trending'], ['Best sellers', '/best-sellers'], ['New releases', '/new-releases']]) {
      const shelf = await screen.findByRole('region', { name });
      expect(await within(shelf).findAllByRole('link', { name: /Noise-cancelling Headphones/ })).not.toHaveLength(0);
      expect(within(shelf).getByRole('link', { name: 'See all' })).toHaveAttribute('href', path);
    }
    expect(document.body).not.toHaveTextContent(/API online|Database connected|unreachable/i);
  });

  it('has landmark regions, a skip link and a search box', async () => {
    stubCatalogFetch();
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    expect(within(screen.getByRole('banner')).getByRole('combobox', { name: 'Search products' })).toBeInTheDocument();
  });

  it('shows an error with a retry button when a shelf cannot load', async () => {
    stubCatalogFetch({ '/api/discover': () => ({ __error: true, status: 500, code: 'ERROR', message: 'Server error.' }) });
    renderApp({ route: '/trending' });
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error.');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('shows a 404 page for unknown addresses', async () => {
    stubCatalogFetch();
    renderApp({ route: '/nope' });
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
