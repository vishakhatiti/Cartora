import { Link } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { formatCount } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import StatusPanel from '../components/StatusPanel.jsx';
import { ErrorNotice, ProductGrid, ProductGridSkeleton } from '../components/ProductCard.jsx';

export default function HomePage() {
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const top = useRemote((signal) => catalogApi.products({ sort: 'relevance', pageSize: 8 }, signal), []);

  return (
    <div className="settle">
      <section className="text-center">
        <h1 className="mx-auto max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Shop smarter. Sell from the same account.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
          A calmer marketplace: no sponsored clutter, no forced accounts, and one login for buying and selling.
        </p>
        <Link to="/products" className="mt-6 inline-block rounded-full bg-primary px-6 py-3 font-semibold text-primary-fg transition-transform hover:-translate-y-0.5">
          Browse all products
        </Link>
      </section>

      <section aria-labelledby="cats-h" className="mt-14">
        <h2 id="cats-h" className="text-xl font-bold">Shop by category</h2>
        {cats.status === 'error' ? null : (
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(cats.data?.categories ?? Array.from({ length: 8 }, (_, i) => ({ slug: `s${i}`, skeleton: true }))).map((c) => (
              <li key={c.slug}>
                {c.skeleton ? <div className="skeleton h-16 rounded-2xl" /> : (
                  <Link to={`/products?category=${c.slug}`} className="flex h-16 flex-col justify-center rounded-2xl border border-line bg-surface px-4 transition duration-200 hover:-translate-y-0.5 hover:border-primary">
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-xs text-muted">{formatCount(c.count)} products</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="top-h" className="mt-14">
        <div className="flex items-end justify-between gap-3">
          <h2 id="top-h" className="text-xl font-bold">Most-rated products</h2>
          <Link to="/products" className="text-sm font-semibold text-primary hover:underline">See all</Link>
        </div>
        <div className="mt-4">
          {top.status === 'error' && <ErrorNotice error={top.error} onRetry={top.retry} />}
          {top.status === 'loading' && !top.data && <ProductGridSkeleton count={4} />}
          {top.data && <ProductGrid items={top.data.items.slice(0, 4)} />}
        </div>
      </section>

      <p className="mt-14 text-center text-sm text-muted">Cart, wishlist, payments and selling are being built next.</p>
      <div className="mx-auto mt-4 max-w-md"><StatusPanel /></div>
    </div>
  );
}
