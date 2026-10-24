import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from './ToastContext.jsx';

function Trigger() {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success('Saved')}>ok</button>
      <button onClick={() => toast.error('Failed')}>bad</button>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe('toasts', () => {
  it('announces success politely and errors as alerts', async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText('ok'));
    await userEvent.click(screen.getByText('bad'));
    expect(screen.getByRole('status')).toHaveTextContent('Saved');
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('can be dismissed by hand', async () => {
    render(<ToastProvider><Trigger /></ToastProvider>);
    await userEvent.click(screen.getByText('ok'));
    await userEvent.click(screen.getByRole('button', { name: 'Dismiss message' }));
    await vi.waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument());
  });

  it('disappears on its own after a few seconds', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    render(<ToastProvider><Trigger /></ToastProvider>);
    await act(async () => { screen.getByText('ok').click(); });
    expect(screen.getByText('Saved')).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(5100); });
    await vi.waitFor(() => expect(screen.queryByText('Saved')).not.toBeInTheDocument());
  });

  it('refuses to be used outside its provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(/ToastProvider/);
    spy.mockRestore();
  });
});
