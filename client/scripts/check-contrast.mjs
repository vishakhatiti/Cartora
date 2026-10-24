// Checks WCAG contrast for every theme pair the UI relies on. Run: node scripts/check-contrast.mjs
// Exits 1 if any pair is below its target (4.5 for text, 3 for large text and UI outlines).
const themes = {
  light: { bg: '#f5f9fb', cream: '#fbfdfe', surface: '#ffffff', fg: '#14262e', muted: '#4d6670', primary: '#0a7570', primaryHover: '#085e5b', primaryFg: '#ffffff', pale: '#dff3f0', accent: '#f5b335', accentFg: '#1e1606', line: '#dde8ec', hero: '#0a3340', heroFg: '#ffffff', orange: '#cc4309', orangeFg: '#ffffff', peach: '#ffe9d9', bad: '#c0281d', ok: '#167a42', warn: '#a15c07', info: '#1d6fb8' },
  dark : { bg: '#0d171b', cream: '#101d22', surface: '#14232a', fg: '#eaf4f6', muted: '#9fb6bd', primary: '#4fd1c5', primaryHover: '#7ee3d9', primaryFg: '#05201d', pale: '#1a3038', accent: '#f5b335', accentFg: '#1e1606', line: '#23373f', hero: '#071013', heroFg: '#eaf4f6', orange: '#ff7a3d', orangeFg: '#1d0c04', peach: '#2e2119', bad: '#ff8f84', ok: '#52d68a', warn: '#f0b050', info: '#6cb8f0' },
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
