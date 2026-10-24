import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ThemeSwitcher from './ThemeSwitcher.jsx';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.setAttribute('data-theme', 'light');
});

describe('ThemeSwitcher', () => {
  it('offers the two themes and marks the active one', () => {
    render(<ThemeSwitcher />);
    const radios = screen.getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-label'))).toEqual(['Ivory theme', 'Night theme']);
    expect(screen.getByRole('radio', { name: 'Ivory theme' })).toBeChecked();
  });

  it('applies and remembers the chosen theme', async () => {
    render(<ThemeSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: 'Night theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    expect(localStorage.getItem('cartora-theme')).toBe('dark');
    expect(screen.getByRole('radio', { name: 'Night theme' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Ivory theme' })).not.toBeChecked();
  });

  it('still switches when storage is blocked', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    render(<ThemeSwitcher />);
    await userEvent.click(screen.getByRole('radio', { name: 'Night theme' }));
    expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    vi.restoreAllMocks();
  });
});
