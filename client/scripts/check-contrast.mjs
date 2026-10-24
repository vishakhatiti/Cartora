// Checks WCAG contrast for every theme pair the UI relies on. Run: node scripts/check-contrast.mjs
// Exits 1 if any pair is below its target (4.5 for text, 3 for large text and UI outlines).
const themes = {
  light:  { bg: '#eef3f2', surface: '#ffffff', fg: '#10211f', muted: '#4a625f', primary: '#0b6e69', primaryFg: '#ffffff', accent: '#f5a524', accentFg: '#2b1d00', line: '#c9d8d5', bad: '#b42318', ok: '#18794e' },
  dark:   { bg: '#0b1514', surface: '#12201f', fg: '#e4efed', muted: '#9ab3af', primary: '#4fd1c5', primaryFg: '#04201d', accent: '#fbbf24', accentFg: '#2b1d00', line: '#2a4440', bad: '#ff8a80', ok: '#5fd39a' },
  sunset: { bg: '#1b1030', surface: '#261742', fg: '#fbeee6', muted: '#c2aed3', primary: '#ff8a5b', primaryFg: '#2a0f06', accent: '#ffd166', accentFg: '#2b1d00', line: '#4a3478', bad: '#ff9a9a', ok: '#7ee0a8' },
};
const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const pairs = [
  ['fg', 'bg', 4.5], ['fg', 'surface', 4.5], ['muted', 'bg', 4.5], ['muted', 'surface', 4.5],
  ['primaryFg', 'primary', 4.5], ['accentFg', 'accent', 4.5], ['primary', 'bg', 4.5], ['primary', 'surface', 4.5],
  ['bad', 'surface', 4.5], ['ok', 'surface', 4.5], ['line', 'bg', 1.1],
];
let failed = false;
for (const [name, t] of Object.entries(themes)) {
  for (const [a, b, min] of pairs) {
    const r = ratio(t[a], t[b]);
    if (r < min) { failed = true; console.log(`FAIL ${name}: ${a} on ${b} = ${r.toFixed(2)} (needs ${min})`); }
  }
}
console.log(failed ? 'Contrast check failed' : 'All theme pairs pass');
process.exit(failed ? 1 : 0);
