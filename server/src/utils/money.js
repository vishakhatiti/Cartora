// All money in Cartora is integer cents. Prices and totals are always computed on the server.

export const FREE_SHIPPING_THRESHOLD_CENTS = 5000; // free at $50.00 or more
export const FLAT_SHIPPING_CENTS = 599; // otherwise $5.99
export const MAX_QTY_PER_ITEM = 99;

/** Convert a dollar amount (number or numeric string) to integer cents. */
export function dollarsToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) {
    throw new RangeError('Amount must be a non-negative number');
  }
  return Math.round(number * 100);
}

/** The price a buyer pays for one unit: the sale price when a valid deal exists. */
export function effectivePriceCents({ priceCents, deal } = {}) {
  const sale = deal?.salePriceCents;
  if (deal?.percent > 0 && Number.isInteger(sale) && sale > 0 && sale < priceCents) {
    return sale;
  }
  return priceCents;
}

/** Free shipping at $50.00 or more, flat $5.99 below that. An empty cart ships for $0. */
export function computeShippingCents(subtotalCents) {
  if (subtotalCents <= 0 || subtotalCents >= FREE_SHIPPING_THRESHOLD_CENTS) return 0;
  return FLAT_SHIPPING_CENTS;
}

/** items: [{ unitPriceCents, qty }] -> { subtotalCents, shippingCents, totalCents } */
export function computeTotals(items) {
  let subtotalCents = 0;
  for (const { unitPriceCents, qty } of items) {
    if (!Number.isInteger(unitPriceCents) || unitPriceCents < 0) {
      throw new RangeError('unitPriceCents must be a non-negative integer');
    }
    if (!Number.isInteger(qty) || qty < 1 || qty > MAX_QTY_PER_ITEM) {
      throw new RangeError(`qty must be an integer from 1 to ${MAX_QTY_PER_ITEM}`);
    }
    subtotalCents += unitPriceCents * qty;
  }
  const shippingCents = computeShippingCents(subtotalCents);
  return { subtotalCents, shippingCents, totalCents: subtotalCents + shippingCents };
}
