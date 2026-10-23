import { useState } from 'react';

const STORAGE_KEY = 'cartora-theme';

function currentTheme() {
  return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage can be blocked (private mode). The theme still changes for this visit.
    }
    setTheme(next);
  }

  const goingDark = theme === 'light';
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={goingDark ? 'Switch to dark theme' : 'Switch to light theme'}
      className="rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium transition-colors hover:border-primary hover:text-primary"
    >
      <span aria-hidden="true">{goingDark ? '🌙' : '☀️'}</span>
      <span className="ml-2">{goingDark ? 'Dark' : 'Light'}</span>
    </button>
  );
}
