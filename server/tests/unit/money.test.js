import { describe, it, expect } from 'vitest';
import {
  dollarsToCents,
  effectivePriceCents,
  computeShippingCents,
  computeTotals,
  FREE_SHIPPING_THRESHOLD_CENTS,
  FLAT_SHIPPING_CENTS,
} from '../../src/utils/money.js';

describe('dollarsToCents', () => {
  it('converts numbers and numeric strings without float drift', () => {
    expect(dollarsToCents('104.59')).toBe(10459);
    expect(dollarsToCents(19.99)).toBe(1999);
    expect(dollarsToCents(0)).toBe(0);
  });

  it('rejects invalid or negative amounts', () => {
    expect(() => dollarsToCents('abc')).toThrow(RangeError);
    expect(() => dollarsToCents(-1)).toThrow(RangeError);
    expect(() => dollarsToCents(undefined)).toThrow(RangeError);
  });
});

describe('effectivePriceCents', () => {
  it('uses the sale price when a valid deal exists', () => {
    expect(effectivePriceCents({ priceCents: 10000, deal: { percent: 15, salePriceCents: 8500 } })).toBe(8500);
  });

  it('ignores a deal that is not actually cheaper or has no percent', () => {
    expect(effectivePriceCents({ priceCents: 10000, deal: { percent: 15, salePriceCents: 12000 } })).toBe(10000);
    expect(effectivePriceCents({ priceCents: 10000, deal: { percent: 0, salePriceCents: 5000 } })).toBe(10000);
    expect(effectivePriceCents({ priceCents: 10000 })).toBe(10000);
  });
});

describe('computeShippingCents', () => {
  it('is free at exactly $50.00 and above', () => {
    expect(computeShippingCents(5000)).toBe(0);
    expect(computeShippingCents(20000)).toBe(0);
    // The exported constants must match the documented rule: free at $50.00, otherwise $5.99.
    expect(FREE_SHIPPING_THRESHOLD_CENTS).toBe(5000);
    expect(FLAT_SHIPPING_CENTS).toBe(599);
  });

  it('is a flat $5.99 below $50.00', () => {
    expect(computeShippingCents(4999)).toBe(FLAT_SHIPPING_CENTS);
    expect(computeShippingCents(1)).toBe(599);
  });

  it('is free for an empty cart', () => {
    expect(computeShippingCents(0)).toBe(0);
  });
});

describe('computeTotals', () => {
  it('adds shipping below the threshold', () => {
    expect(computeTotals([{ unitPriceCents: 2000, qty: 2 }])).toEqual({
      subtotalCents: 4000,
      shippingCents: 599,
      totalCents: 4599,
    });
  });

  it('has no shipping at or above the threshold', () => {
    expect(computeTotals([{ unitPriceCents: 5000, qty: 1 }])).toEqual({
      subtotalCents: 5000,
      shippingCents: 0,
      totalCents: 5000,
    });
  });

  it('sums several lines', () => {
    const totals = computeTotals([
      { unitPriceCents: 1999, qty: 1 },
      { unitPriceCents: 3001, qty: 2 },
    ]);
    expect(totals.subtotalCents).toBe(8001);
    expect(totals.totalCents).toBe(8001);
  });

  it('rejects bad quantities and prices', () => {
    expect(() => computeTotals([{ unitPriceCents: 100, qty: 0 }])).toThrow(RangeError);
    expect(() => computeTotals([{ unitPriceCents: 100, qty: 100 }])).toThrow(RangeError);
    expect(() => computeTotals([{ unitPriceCents: 10.5, qty: 1 }])).toThrow(RangeError);
    expect(() => computeTotals([{ unitPriceCents: -1, qty: 1 }])).toThrow(RangeError);
  });
});
