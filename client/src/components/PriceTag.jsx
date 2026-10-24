import { formatPrice } from '../lib/format.js';

/**
 * The price. On the product page (`large`) it is drawn as the Cartora price tag; in lists it is plain bold text.
 * The old price shows only when a real deal exists.
 */
export default function PriceTag({ product, large = false }) {
  const onDeal = product.deal && product.finalPriceCents < product.priceCents;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={large ? 'price-tag price-tag-lg' : 'text-lg font-extrabold'}>{formatPrice(product.finalPriceCents)}</span>
      {onDeal && <s className="text-sm text-muted">{formatPrice(product.priceCents)}</s>}
    </span>
  );
}
