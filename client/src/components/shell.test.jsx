import { describe, it, expect, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import Drawer from './Drawer.jsx';
import Dialog, { ConfirmDialog } from './Dialog.jsx';
import { renderApp } from '../test/renderApp.jsx';
import { stubCatalogFetch } from '../test/catalogFixtures.js';

function DrawerHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button onClick={() => setOpen(true)}>Open</button>
      <Drawer open={open} onClose={() => setOpen(false)} title="Menu"><a href="/one">One</a><a href="/two">Two</a></Drawer>
    </>
  );
}

describe('drawer', () => {
  it('moves focus in, traps Tab, closes on Escape and returns focus', async () => {
    render(<DrawerHarness />);
    const opener = screen.getByRole('button', { name: 'Open' });
    await userEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Menu' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(within(dialog).getByRole('button', { name: 'Close menu' })).toHaveFocus();
    await userEvent.tab(); await userEvent.tab(); await userEvent.tab(); // close, One, Two, then wraps
    expect(within(dialog).getByRole('button', { name: 'Close menu' })).toHaveFocus();
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes on backdrop click and locks page scroll while open', async () => {
    render(<DrawerHarness />);
    await userEvent.click(screen.getByRole('button', { name: 'Open' }));
    expect(document.body.style.overflow).toBe('hidden');
    await userEvent.click(screen.getByTestId('drawer-backdrop'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});

describe('dialogs', () => {
  it('is labelled by its title and closes on Escape', async () => {
    const onClose = vi.fn();
    render(<Dialog open onClose={onClose} title="Remove item?">Sure?</Dialog>);
    expect(screen.getByRole('dialog', { name: 'Remove item?' })).toBeInTheDocument();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('cannot be dismissed or confirmed twice while busy', async () => {
    const onClose = vi.fn(); const onConfirm = vi.fn();
    render(<ConfirmDialog open busy onClose={onClose} onConfirm={onConfirm} title="Delete" message="m" confirmLabel="Delete" />);
    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    await userEvent.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('confirms and cancels', async () => {
    const onClose = vi.fn(); const onConfirm = vi.fn();
    render(<ConfirmDialog open onClose={onClose} onConfirm={onConfirm} title="Delete" message="m" confirmLabel="Delete" />);
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('header, menu and footer', () => {
  it('opens the menu with categories and account links for a guest', async () => {
    stubCatalogFetch();
    renderApp();
    await userEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const menu = screen.getByRole('dialog', { name: 'Hello, guest' });
    expect(await within(menu).findByRole('link', { name: 'Books' })).toHaveAttribute('href', '/products?category=books');
    expect(within(menu).getByRole('link', { name: 'Create account' })).toBeInTheDocument();
    await userEvent.click(within(menu).getByRole('link', { name: 'All products' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('shows real category shortcuts in the second header row and a footer without invented details', async () => {
    stubCatalogFetch();
    renderApp();
    const row = screen.getByRole('navigation', { name: 'Categories' });
    expect(await within(row).findByRole('link', { name: 'Electronics' })).toHaveAttribute('href', '/products?category=electronics');
    const footer = screen.getByRole('contentinfo');
    expect(within(footer).getByRole('link', { name: 'All products' })).toBeInTheDocument();
    expect(footer.textContent).not.toMatch(/\+?\d{3}[-\s]\d{3}/); // no made-up phone number
  });

  it('searches inside the chosen category', async () => {
    const spy = stubCatalogFetch();
    renderApp();
    await within(screen.getByRole('banner')).findByRole('option', { name: 'Books' });
    await userEvent.selectOptions(screen.getByLabelText('Search category'), 'books');
    await userEvent.type(screen.getByRole('combobox', { name: 'Search products' }), 'novel{Enter}');
    expect(spy.mock.calls.some(([u]) => String(u).includes('q=novel') && String(u).includes('category=books'))).toBe(true);
  });
});
