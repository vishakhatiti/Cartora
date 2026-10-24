export const THEMES = [
  { id: 'light', label: 'Harbor', swatch: ['#eef3f2', '#0b6e69'] },
  { id: 'dark', label: 'Night', swatch: ['#0b1514', '#4fd1c5'] },
  { id: 'sunset', label: 'Sunset', swatch: ['#1b1030', '#ff8a5b'] },
];

const KEY = 'cartora-theme';
const isTheme = (value) => THEMES.some((t) => t.id === value);

/** The theme currently applied to the page (set before first paint by index.html). */
export function currentTheme() {
  const applied = document.documentElement.getAttribute('data-theme');
  return isTheme(applied) ? applied : 'light';
}

/** Apply a theme and remember it. Storage can be blocked, so a failure is ignored. */
export function applyTheme(id) {
  if (!isTheme(id)) return;
  document.documentElement.setAttribute('data-theme', id);
  try {
    localStorage.setItem(KEY, id);
  } catch {
    /* private mode or blocked storage: the theme still applies for this visit */
  }
}
