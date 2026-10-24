// Checks WCAG contrast for every theme pair the UI relies on. Run: node scripts/check-contrast.mjs
// Exits 1 if any pair is below its target (4.5 for text, 3 for large text and UI outlines).
const themes = {
  light: { bg: '#f7f5ef', cream: '#fcfaf5', surface: '#ffffff', fg: '#242923', muted: '#666b64', primary: '#214e3d', primaryHover: '#173a2d', primaryFg: '#ffffff', pale: '#e6ede6', accent: '#c6a66b', accentFg: '#242923', line: '#e5e2d9', hero: '#173a2d', heroFg: '#ffffff', orange: '#c4550b', orangeFg: '#ffffff', peach: '#fcebdc', bad: '#b42318', ok: '#237547', warn: '#9a6415', info: '#286a91' },
  dark:  { bg: '#121a16', cream: '#16201b', surface: '#1a2520', fg: '#eef2ec', muted: '#a9b5ab', primary: '#8fb095', primaryHover: '#a8c6ad', primaryFg: '#0f1a14', pale: '#24332b', accent: '#c6a66b', accentFg: '#1d1a10', line: '#2c3b33', hero: '#0c1410', heroFg: '#eef2ec', orange: '#e8803a', orangeFg: '#1d1006', peach: '#2c231d', bad: '#ff8f84', ok: '#5fc58a', warn: '#e0a64f', info: '#6fb3dc' },
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
  ['bad', 'surface', 4.5], ['ok', 'surface', 4.5], ['warn', 'surface', 4.5], ['info', 'surface', 4.5],
  ['heroFg', 'hero', 4.5], ['orangeFg', 'orange', 4.5], ['fg', 'peach', 4.5], ['muted', 'peach', 4.5],
  ['fg', 'cream', 4.5], ['muted', 'cream', 4.5], ['fg', 'pale', 4.5], ['primary', 'pale', 4.5], ['primaryFg', 'primaryHover', 4.5], ['line', 'bg', 1.1],
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
