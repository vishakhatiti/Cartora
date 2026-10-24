import { formatPrice } from '../lib/format.js';

/** The price in a tag shape, the Cartora motif. Shows the old price only when a real deal exists. */
export default function PriceTag({ product, large = false }) {
  const onDeal = product.deal && product.finalPriceCents < product.priceCents;
  return (
    <span className="inline-flex items-baseline gap-2">
      <span className={`price-tag ${large ? 'price-tag-lg' : ''}`}>{formatPrice(product.finalPriceCents)}</span>
      {onDeal && <s className="text-sm text-muted">{formatPrice(product.priceCents)}</s>}
    </span>
  );
}
