import { describe, it, expect, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderApp, fakeApi, asha } from '../test/renderApp.jsx';

describe('account menu', () => {
  it('lists every item, on its own readable text colour (the header text is light, the menu is not)', async () => {
    renderApp({ api: fakeApi({ me: vi.fn().mockResolvedValue({ user: asha }) }) });
    await userEvent.click(await screen.findByRole('button', { name: /Account menu for/ }));
    const menu = screen.getByRole('menu');
    expect(menu).toHaveClass('text-fg'); // without it, the links inherit the header's light colour and vanish
    for (const name of ['Your account', 'Your orders', 'Wishlist', 'Customer service', 'Sign out']) {
      expect(screen.getByRole('menuitem', { name })).toBeInTheDocument();
    }
  });
});
