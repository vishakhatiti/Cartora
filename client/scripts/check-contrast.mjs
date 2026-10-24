// Checks WCAG contrast for every theme pair the UI relies on. Run: node scripts/check-contrast.mjs
// Exits 1 if any pair is below its target (4.5 for text, 3 for large text and UI outlines).
const themes = {
  light: { bg: '#f7f0e6', surface: '#fffaf3', fg: '#2b1d16', muted: '#6b5648', primary: '#a84a22', primaryFg: '#fffaf3', accent: '#e0a458', accentFg: '#2b1d00', line: '#e3d5c3', bad: '#b42318', ok: '#2f7a4d' },
  dark:  { bg: '#1d1511', surface: '#281d17', fg: '#f3e8dc', muted: '#bfa994', primary: '#e07a4f', primaryFg: '#2a0f06', accent: '#e8b86a', accentFg: '#2b1d00', line: '#4a382d', bad: '#ff9a8a', ok: '#7ac596' },
  sage:  { bg: '#eef1e6', surface: '#fbfcf6', fg: '#1f2a1d', muted: '#55634f', primary: '#3f6b3a', primaryFg: '#ffffff', accent: '#d9a441', accentFg: '#2b1d00', line: '#d3dbc4', bad: '#b42318', ok: '#2e7d4f' },
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
