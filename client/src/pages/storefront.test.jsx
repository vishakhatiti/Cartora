import { describe, it, expect } from 'vitest';
import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp } from '../test/renderApp.jsx';
import { apiError, detail, makeProduct, reviewsPage, stubCatalogFetch } from '../test/catalogFixtures.js';
import { toQuery } from '../lib/catalogApi.js';
import { formatPrice } from '../lib/format.js';

const calledWith = (spy, fragment) => spy.mock.calls.some(([u]) => String(u).includes(fragment));

describe('helpers', () => {
  it('builds queries without empty values', () => {
    expect(toQuery({ q: 'a b', category: '', page: 2, x: undefined })).toBe('q=a+b&page=2');
  });
  it('formats integer cents as dollars', () => {
    expect(formatPrice(5999)).toBe('$59.99');
    expect(formatPrice(5)).toBe('$0.05');
  });
});

describe('products page', () => {
  it('lists products with price tags and links, and shows artwork for a product without photo', async () => {
    stubCatalogFetch();
    renderApp({ route: '/products' });
    const card = (await screen.findByRole('link', { name: /Noise-cancelling Headphones/ }));
    expect(card).toHaveAttribute('href', '/product/B0TEST0001');
    expect(within(card).getByText('$59.99')).toBeInTheDocument();
    expect(within(card).getByRole('img', { name: /4\.5 out of 5 stars, 1,200 ratings/ })).toBeInTheDocument();
    const book = screen.getByRole('link', { name: /Paperback Novel/ });
    expect(within(book).getByRole('img', { name: /no photo available/ })).toBeInTheDocument();
    expect(screen.getByText(/2 products from the Cartora catalogue/)).toBeInTheDocument();
  });

  it('switches to artwork when a photo fails to load', async () => {
    stubCatalogFetch();
    renderApp({ route: '/products' });
    const card = await screen.findByRole('link', { name: /Noise-cancelling Headphones/ });
    const photo = card.querySelector('img');
    expect(photo).toHaveAttribute('src', 'https://img.test/a.jpg');
    fireEvent.error(photo);
    expect(within(card).getByRole('img', { name: /no photo available/ })).toBeInTheDocument();
  });

  it('puts filters, sort and page in the request and the URL state', async () => {
    const spy = stubCatalogFetch();
    renderApp({ route: '/products?q=head' });
    await screen.findByRole('link', { name: /Noise-cancelling Headphones/ });
    expect(calledWith(spy, 'q=head')).toBe(true);

    const panel = screen.getAllByRole('button', { name: /Electronics/ })[0];
    await userEvent.click(panel);
    await waitFor(() => expect(calledWith(spy, 'category=electronics')).toBe(true));

    await userEvent.selectOptions(screen.getByLabelText(/Sort by/), 'price_asc');
    await waitFor(() => expect(calledWith(spy, 'sort=price_asc')).toBe(true));

    await userEvent.click(screen.getAllByRole('button', { name: '3 stars and up' })[0]);
    await waitFor(() => expect(calledWith(spy, 'minRating=3')).toBe(true));
    expect(screen.getByRole('button', { name: 'Remove filter Electronics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove filter 3 stars & up' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.queryByRole('button', { name: /Remove filter/ })).not.toBeInTheDocument();
  });

  it('applies a price range', async () => {
    const spy = stubCatalogFetch();
    renderApp({ route: '/products' });
    await screen.findByRole('link', { name: /Noise-cancelling Headphones/ });
    const min = screen.getAllByLabelText('Min')[0];
    const max = screen.getAllByLabelText('Max')[0];
    await userEvent.type(min, '10');
    await userEvent.type(max, '80');
    await userEvent.click(screen.getAllByRole('button', { name: 'Go' })[0]);
    await waitFor(() => expect(calledWith(spy, 'minPrice=10')).toBe(true));
    expect(calledWith(spy, 'maxPrice=80')).toBe(true);
  });

  it('pages through results', async () => {
    const spy = stubCatalogFetch({
      '/api/products': (url) => ({ items: [makeProduct()], page: Number(url.searchParams.get('page') ?? 1), pageSize: 24, total: 60, totalPages: 3, facets: { categories: [], brands: [] } }),
    });
    renderApp({ route: '/products' });
    await screen.findByRole('link', { name: /Noise-cancelling Headphones/ });
    await userEvent.click(screen.getByRole('button', { name: 'Next' }));
    await waitFor(() => expect(calledWith(spy, 'page=2')).toBe(true));
    expect(await screen.findByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
  });

  it('shows an empty state and a way back', async () => {
    stubCatalogFetch({ '/api/products': () => ({ items: [], page: 1, pageSize: 24, total: 0, totalPages: 1, facets: { categories: [], brands: [] } }) });
    renderApp({ route: '/products?q=zzzz' });
    expect(await screen.findByText('No products match.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start over' })).toBeInTheDocument();
  });
});

describe('search box', () => {
  it('suggests products and categories and opens the chosen one', async () => {
    stubCatalogFetch({
      '/api/products/B0TEST0001/reviews': () => reviewsPage,
      '/api/products/B0TEST0001/related': () => ({ items: [] }),
      '/api/products/B0TEST0001': () => ({ product: detail() }),
    });
    renderApp({ route: '/products' });
    await userEvent.type(screen.getAllByRole('combobox', { name: 'Search products' })[0], 'head');
    const list = await screen.findByRole('listbox');
    const options = within(list).getAllByRole('option');
    expect(options.map((o) => o.textContent)).toEqual(['ElectronicsCategory', 'Noise-cancelling HeadphonesElectronics']);
    await userEvent.click(options[1]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Noise-cancelling Headphones' })).toBeInTheDocument();
  });

  it('searches the typed text on Enter', async () => {
    const spy = stubCatalogFetch();
    renderApp({ route: '/' });
    await userEvent.type(screen.getByRole('combobox', { name: 'Search products' }), 'red shoes{Enter}');
    await waitFor(() => expect(calledWith(spy, '/api/products?q=red+shoes')).toBe(true));
    expect(await screen.findByRole('heading', { level: 1, name: 'Results for “red shoes”' })).toBeInTheDocument();
  });
});

describe('product page', () => {
  const routes = () => ({
    '/api/products/B0TEST0001/reviews': () => reviewsPage,
    '/api/products/B0TEST0001/related': () => ({ items: [makeProduct({ id: 'B0TEST0009', title: 'Travel Case' })] }),
    '/api/products/B0TEST0001': () => ({ product: detail() }),
  });

  it('shows the product, specifications, rating breakdown, reviews and related products', async () => {
    stubCatalogFetch(routes());
    renderApp({ route: '/product/B0TEST0001' });
    expect(await screen.findByRole('heading', { level: 1, name: 'Noise-cancelling Headphones' })).toBeInTheDocument();
    expect(screen.getByText('$59.99', { selector: '.price-tag-lg' })).toBeInTheDocument();
    expect(screen.getByText('Fifty hour battery')).toBeInTheDocument();
    expect(screen.getByText('Comfortable over-ear headphones.')).toBeInTheDocument();
    expect(screen.getByText('Color')).toBeInTheDocument();
    expect(within(screen.getByRole('list', { name: 'Rating breakdown' })).getAllByRole('listitem')).toHaveLength(5);
    expect(await screen.findByText('Great sound')).toBeInTheDocument();
    expect(screen.getByText(/Verified purchase/)).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: /Travel Case/ })).toBeInTheDocument();
  });

  it('changes the main photo from the thumbnails', async () => {
    stubCatalogFetch(routes());
    renderApp({ route: '/product/B0TEST0001' });
    await screen.findByRole('heading', { level: 1 });
    const main = () => document.querySelector('article img[src*="img.test"][loading="eager"]');
    expect(main()).toHaveAttribute('src', 'https://img.test/a.jpg');
    await userEvent.click(screen.getByRole('button', { name: 'Show photo 2 of 2' }));
    expect(main()).toHaveAttribute('src', 'https://img.test/b.jpg');
  });

  it('shows a not-found page for an unknown product', async () => {
    stubCatalogFetch({ '/api/products/NOPE': () => apiError(404, 'NOT_FOUND', 'Product not found') });
    renderApp({ route: '/product/NOPE' });
    expect(await screen.findByRole('heading', { name: 'Product not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Browse products' })).toHaveAttribute('href', '/products');
  });

  it('does not render description text as HTML', async () => {
    stubCatalogFetch({ ...routes(), '/api/products/B0TEST0001': () => ({ product: detail({ description: '<img src=x onerror=alert(1)>' }) }) });
    renderApp({ route: '/product/B0TEST0001' });
    expect(await screen.findByText('<img src=x onerror=alert(1)>')).toBeInTheDocument();
    expect(document.querySelector('img[src="x"]')).toBeNull();
  });
});
