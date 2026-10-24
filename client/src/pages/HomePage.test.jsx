import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderApp } from '../test/renderApp.jsx';

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
});

describe('home page', () => {
  it('renders the landing content and the live API status', async () => {
    renderApp();
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shop smarter.');
    expect(screen.getByRole('heading', { name: 'Coming next' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(await screen.findByText('API online · Database connected')).toBeInTheDocument();
  });

  it('has landmark regions and a skip link', async () => {
    renderApp();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Skip to content' })).toHaveAttribute('href', '#main');
    await screen.findByText('API online · Database connected');
  });

  it('shows a 404 page for unknown addresses', () => {
    renderApp({ route: '/nope' });
    expect(screen.getByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
  });
});
