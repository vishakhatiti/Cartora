import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import GoogleButton from './GoogleButton.jsx';

describe('GoogleButton', () => {
  it('renders nothing without a client id and never loads the script', () => {
    const load = vi.fn();
    const { container } = render(<GoogleButton clientId="" onCredential={() => {}} load={load} />);
    expect(container).toBeEmptyDOMElement();
    expect(load).not.toHaveBeenCalled();
  });

  it('initialises Google with our client id and passes the credential on', async () => {
    const onCredential = vi.fn();
    const id = { initialize: vi.fn(), renderButton: vi.fn() };
    render(<GoogleButton clientId="client-1" onCredential={onCredential} load={() => Promise.resolve({ accounts: { id } })} />);
    await waitFor(() => expect(id.renderButton).toHaveBeenCalled());
    expect(id.initialize).toHaveBeenCalledWith(expect.objectContaining({ client_id: 'client-1' }));
    id.initialize.mock.calls[0][0].callback({ credential: 'signed.id.token' });
    expect(onCredential).toHaveBeenCalledWith('signed.id.token');
    expect(screen.getByTestId('google-button')).toBeInTheDocument();
  });

  it('explains when Google cannot be loaded', async () => {
    render(<GoogleButton clientId="client-1" onCredential={() => {}} load={() => Promise.reject(new Error('blocked'))} />);
    expect(await screen.findByText(/google sign-in is unavailable/i)).toBeInTheDocument();
  });
});
