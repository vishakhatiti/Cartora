// Checks WCAG contrast for every theme pair the UI relies on. Run: node scripts/check-contrast.mjs
// Exits 1 if any pair is below its target (4.5 for text, 3 for large text and UI outlines).
const themes = {
  light: { bg: '#fbf9ff', cream: '#ffffff', surface: '#ffffff', fg: '#1f2340', muted: '#555a7c', primary: '#5b3fd6', primaryHover: '#4a31b8', primaryFg: '#ffffff', pale: '#eee9ff', accent: '#ffd166', accentFg: '#2a2000', line: '#e8e4f5', hero: '#e6defc', hero2: '#d3f1ea', heroFg: '#1f2340', orange: '#cf3c26', orangeFg: '#ffffff', peach: '#ffe5dc', bad: '#c0281d', ok: '#167a42', warn: '#8f5405', info: '#1d6fb8' },
  dark : { bg: '#12101f', cream: '#171428', surface: '#1c1930', fg: '#f1eeff', muted: '#b3aed3', primary: '#b9a6ff', primaryHover: '#cfc2ff', primaryFg: '#1a1236', pale: '#2a2548', accent: '#ffd166', accentFg: '#2a2000', line: '#2e2a4c', hero: '#1e1a3d', hero2: '#143a40', heroFg: '#f1eeff', orange: '#ff8c6b', orangeFg: '#2a0f08', peach: '#3a2530', bad: '#ff9a90', ok: '#5fe0a0', warn: '#f5c060', info: '#7cc2f5' },
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
  ['heroFg', 'hero2', 4.5], ['primary', 'hero', 4.5], ['primary', 'hero2', 4.5], ['fg', 'cream', 4.5], ['muted', 'cream', 4.5], ['fg', 'pale', 4.5], ['primary', 'pale', 4.5], ['primaryFg', 'primaryHover', 4.5], ['line', 'bg', 1.1],
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
