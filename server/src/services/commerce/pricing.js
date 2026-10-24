import { computeTotals, MAX_QTY_PER_ITEM } from '../../utils/money.js';

export const MAX_CART_LINES = 50;

/** Merge duplicate product ids and keep quantities inside 1..MAX_QTY_PER_ITEM. */
export function normalizeItems(items) {
  const byId = new Map();
  for (const { productId, qty } of items ?? []) {
    const id = String(productId ?? '').trim();
    if (!id) continue;
    const n = Math.min(MAX_QTY_PER_ITEM, Math.max(1, Math.trunc(Number(qty) || 0)));
    byId.set(id, Math.min(MAX_QTY_PER_ITEM, (byId.get(id) ?? 0) + n));
  }
  return [...byId].map(([productId, qty]) => ({ productId, qty }));
}

/**
 * Price a list of { productId, qty } from the catalogue. The browser never supplies a price: every
 * unit price comes from the catalogue here. Products that are not in the catalogue are reported in
 * `issues` and left out of the totals.
 */
export function priceItems(catalog, items) {
  const lines = [];
  const issues = [];
  for (const { productId, qty } of normalizeItems(items)) {
    const product = catalog.getById(productId);
    if (!product) {
      issues.push({ productId, reason: 'UNAVAILABLE', message: 'This product is no longer available.' });
      continue;
    }
    lines.push({
      productId,
      title: product.title,
      brand: product.brand || null,
      image: product.images?.[0]?.large ?? null,
      category: product.category?.label ?? null,
      unitPriceCents: product.finalPriceCents,
      qty,
      lineTotalCents: product.finalPriceCents * qty,
    });
  }
  const totals = computeTotals(lines);
  const itemCount = lines.reduce((sum, line) => sum + line.qty, 0);
  return { lines, issues, totals, itemCount, currency: 'usd' };
}
