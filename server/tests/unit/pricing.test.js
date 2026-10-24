import { describe, it, expect } from 'vitest';
import { createCatalog } from '../../src/services/catalog/catalog.js';
import { normalizeItems, priceItems } from '../../src/services/commerce/pricing.js';
import { createPaymentProvider } from '../../src/services/payments/index.js';
import { rawFixture } from '../fixtures/catalogFixture.js';

const catalog = createCatalog(rawFixture);

describe('normalizeItems', () => {
  it('merges duplicates, clamps quantities and drops blank ids', () => {
    expect(normalizeItems([
      { productId: 'A1', qty: 2 }, { productId: 'A1', qty: 3 }, { productId: '  ', qty: 1 }, { productId: 'A4', qty: 500 }, { productId: 'A3', qty: -4 },
    ])).toEqual([{ productId: 'A1', qty: 5 }, { productId: 'A4', qty: 99 }, { productId: 'A3', qty: 1 }]);
  });
});

describe('priceItems', () => {
  it('takes every unit price from the catalogue and ignores any price in the input', () => {
    const { lines, totals } = priceItems(catalog, [{ productId: 'A4', qty: 2, unitPriceCents: 1, priceCents: 1, totalCents: 1 }]);
    expect(lines[0]).toMatchObject({ productId: 'A4', unitPriceCents: 1999, qty: 2, lineTotalCents: 3998 });
    expect(totals).toEqual({ subtotalCents: 3998, shippingCents: 599, totalCents: 4597 });
  });

  it('charges the sale price when a real deal exists', () => {
    expect(priceItems(catalog, [{ productId: 'A2', qty: 1 }]).lines[0].unitPriceCents).toBe(6000);
  });

  it('applies the shipping rule at the $50.00 boundary', () => {
    expect(priceItems(catalog, [{ productId: 'A1', qty: 1 }]).totals).toMatchObject({ subtotalCents: 4999, shippingCents: 599 }); // $49.99
    expect(priceItems(catalog, [{ productId: 'A1', qty: 1 }, { productId: 'A4', qty: 1 }]).totals).toMatchObject({ subtotalCents: 6998, shippingCents: 0 });
  });

  it('reports unknown products as issues and leaves them out of the totals', () => {
    const result = priceItems(catalog, [{ productId: 'A4', qty: 1 }, { productId: 'NOPE', qty: 1 }]);
    expect(result.issues).toEqual([expect.objectContaining({ productId: 'NOPE', reason: 'UNAVAILABLE' })]);
    expect(result.lines).toHaveLength(1);
    expect(result.totals.subtotalCents).toBe(1999);
  });

  it('prices an empty cart at zero with no shipping', () => {
    expect(priceItems(catalog, []).totals).toEqual({ subtotalCents: 0, shippingCents: 0, totalCents: 0 });
  });
});

describe('payment provider selection', () => {
  it('defaults to the demo provider and labels it clearly', () => {
    const provider = createPaymentProvider({});
    expect(provider).toMatchObject({ name: 'demo', isDemo: true, label: 'Demo Mode — No Real Money Charged' });
  });

  it('refuses stripe until it is implemented, instead of pretending', () => {
    expect(() => createPaymentProvider({ PAYMENT_PROVIDER: 'stripe' })).toThrow(/not implemented/);
  });
});
