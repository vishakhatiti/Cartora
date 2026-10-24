export const THEMES = [
  { id: 'light', label: 'Ivory', swatch: ['#f7f5ef', '#214e3d'] },
  { id: 'dark', label: 'Night', swatch: ['#121a16', '#8fb095'] },
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
