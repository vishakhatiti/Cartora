import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from './App.jsx';

describe('App', () => {
  it('renders the landing page with its main sections', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    render(<App />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Shop smarter.');
    expect(screen.getByRole('link', { name: /cartora/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Planned' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(await screen.findByText('API online · Database connected')).toBeInTheDocument();
  });

  it('has landmark regions for accessibility', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    render(<App />);
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    await screen.findByText('API online · Database connected');
  });
});
