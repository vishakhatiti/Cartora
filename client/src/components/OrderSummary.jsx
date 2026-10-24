import { formatPrice } from '../lib/format.js';
import ProductImage from './ProductImage.jsx';

/** Lines and totals exactly as the server priced them. Nothing is calculated in the browser. */
export default function OrderSummary({ lines, totals, title = 'Order summary', children }) {
  const row = 'flex items-center justify-between text-sm';
  return (
    <aside aria-labelledby="summary-h" className="rounded-3xl bg-peach p-5">
      <h2 id="summary-h" className="text-2xl">{title}</h2>
      <ul className="mt-4 space-y-3">
        {lines.map((l) => (
          <li key={l.productId} className="flex items-center gap-3">
            <ProductImage product={{ id: l.productId, title: l.title, brand: l.brand, category: { slug: l.category ?? 'x' }, images: l.image ? [{ thumb: l.image, large: l.image }] : [] }} size="thumb" alt="" className="h-14 w-14 shrink-0 rounded-xl p-1" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-semibold">{l.title}</p>
              <p className="text-xs text-muted">Qty {l.qty} × {formatPrice(l.unitPriceCents)}</p>
            </div>
            <p className="text-sm font-semibold">{formatPrice(l.unitPriceCents * l.qty)}</p>
          </li>
        ))}
      </ul>
      <dl className="mt-5 space-y-1.5 border-t border-line-strong pt-4">
        <div className={row}><dt className="text-muted">Subtotal</dt><dd>{formatPrice(totals.subtotalCents)}</dd></div>
        <div className={row}><dt className="text-muted">Shipping</dt><dd>{totals.shippingCents === 0 ? 'Free' : formatPrice(totals.shippingCents)}</dd></div>
        <div className={row}><dt className="text-muted">Tax</dt><dd>Not charged</dd></div>
        <div className="flex items-center justify-between pt-2 text-lg font-extrabold"><dt>Total</dt><dd>{formatPrice(totals.totalCents)}</dd></div>
      </dl>
      <p className="mt-2 text-xs text-muted">Shipping is free from $50.00; below that it is $5.99.</p>
      {children}
    </aside>
  );
}
