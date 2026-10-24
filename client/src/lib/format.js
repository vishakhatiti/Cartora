const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Prices are integer cents everywhere; only this function turns them into text. */
export const formatPrice = (cents) => usd.format(cents / 100);

export const formatCount = (n) => new Intl.NumberFormat('en-US').format(n);

export function formatDate(iso) {
  if (!iso) return '';
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '' : date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
