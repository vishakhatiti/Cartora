import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StatusPanel from './StatusPanel.jsx';

const respond = (status) => vi.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status });

describe('StatusPanel', () => {
  it('shows a checking message first, then the ready state', async () => {
    const fetchMock = respond(200);
    vi.stubGlobal('fetch', fetchMock);
    render(<StatusPanel />);

    expect(screen.getByText('Checking the server…')).toBeInTheDocument();
    expect(await screen.findByText('API online · Database connected')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith('/api/health/ready', expect.objectContaining({ headers: { Accept: 'application/json' } }));
  });

  it('explains when the API is up but the database is not (HTTP 503)', async () => {
    vi.stubGlobal('fetch', respond(503));
    render(<StatusPanel />);
    expect(await screen.findByText('API online · Database unavailable')).toBeInTheDocument();
  });

  it('reports the API as unreachable when the request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<StatusPanel />);
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });

  it('treats an unexpected HTTP error as unreachable', async () => {
    vi.stubGlobal('fetch', respond(404));
    render(<StatusPanel />);
    expect(await screen.findByText('API unreachable')).toBeInTheDocument();
  });

  it('lets the user check again and recovers when the server wakes up', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
    render(<StatusPanel />);

    await screen.findByText('API unreachable');
    await userEvent.click(screen.getByRole('button', { name: 'Check again' }));

    expect(await screen.findByText('API online · Database connected')).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
