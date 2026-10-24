import { Link } from 'react-router-dom';
import ProductImage from './ProductImage.jsx';
import PriceTag from './PriceTag.jsx';
import Stars from './Stars.jsx';

export default function ProductCard({ product }) {
  return (
    <li className="group">
      <Link
        to={`/product/${product.id}`}
        className="flex h-full flex-col overflow-hidden rounded-2xl border border-line bg-surface transition duration-200 hover:-translate-y-1 hover:border-primary hover:shadow-lg"
      >
        <ProductImage product={product} size="large" className="aspect-square w-full p-3 transition-transform duration-300 group-hover:scale-[1.03]" />
        <div className="flex flex-1 flex-col gap-1.5 p-3">
          {product.brand && <span className="text-xs font-semibold uppercase tracking-wide text-muted">{product.brand}</span>}
          <h3 className="line-clamp-2 font-sans text-sm font-semibold leading-snug">{product.title}</h3>
          <Stars value={product.ratingAvg} count={product.ratingCount} />
          <div className="mt-auto pt-2"><PriceTag product={product} /></div>
        </div>
      </Link>
    </li>
  );
}

export function ProductGrid({ items }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
      {items.map((p) => <ProductCard key={p.id} product={p} />)}
    </ul>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4" aria-busy="true" aria-label="Loading products">
      {Array.from({ length: count }, (_, i) => (
        <li key={i} className="overflow-hidden rounded-2xl border border-line bg-surface">
          <div className="skeleton aspect-square w-full" />
          <div className="space-y-2 p-3"><div className="skeleton h-3 w-1/3 rounded" /><div className="skeleton h-4 w-full rounded" /><div className="skeleton h-4 w-2/3 rounded" /></div>
        </li>
      ))}
    </ul>
  );
}

export function ErrorNotice({ error, onRetry }) {
  return (
    <div role="alert" className="rounded-2xl border border-line bg-surface p-6 text-center">
      <p className="font-semibold">{error?.message ?? 'Something went wrong.'}</p>
      <p className="mt-1 text-sm text-muted">The server may be waking up. This can take up to a minute on the free plan.</p>
      <button type="button" onClick={onRetry} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">Try again</button>
    </div>
  );
}
