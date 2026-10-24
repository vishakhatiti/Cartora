import { Link } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { formatCount } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import ProductImage from '../components/ProductImage.jsx';
import Shelf from '../components/Shelf.jsx';
import { SHELVES, pickFeatured } from '../lib/shelves.js';

const TILT = ['-rotate-3', 'rotate-2', '-rotate-1'];

export default function HomePage() {
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const top = useRemote((signal) => catalogApi.discover('best-sellers', { pageSize: 48 }, signal), []);
  const shown = pickFeatured(top.data?.items ?? []);

  return (
    <div className="settle">
      <section className="relative overflow-hidden rounded-3xl bg-linear-to-br from-hero to-hero-2 px-6 py-10 text-hero-fg sm:px-12 sm:py-16">
        <div className="pointer-events-none absolute -bottom-16 left-1/3 select-none text-[18rem] leading-none text-hero-fg/5" aria-hidden="true">✳</div>
        <div className="relative grid items-center gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-widest text-primary">One account, two ways to use it</p>
            <h1 className="mt-3 text-5xl leading-[1.05] sm:text-6xl">Shop smarter. Sell from the same account.</h1>
            <p className="mt-5 max-w-lg text-base text-hero-fg/85 sm:text-lg">
              A calmer marketplace: real products, no sponsored clutter, no forced accounts, and one login for buying and selling.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/products" className="rounded-full bg-orange px-6 py-3 font-semibold text-orange-fg">Explore products</Link>
              <Link to="/sell" className="rounded-full border border-hero-fg/40 px-6 py-3 font-semibold text-hero-fg hover:bg-hero-fg/10">Start selling</Link>
            </div>
          </div>
          <ul className="hidden grid-cols-3 gap-3 lg:grid" aria-label="Featured products">
            {shown.slice(0, 3).map((p, i) => (
              <li key={p.id} className={TILT[i]}>
                <Link to={`/product/${p.id}`} aria-label={p.title} className="block overflow-hidden rounded-2xl bg-white shadow-xl transition-transform hover:-translate-y-1">
                  <ProductImage product={p} size="large" alt="" className="aspect-[3/4] w-full p-2" />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section aria-labelledby="cats-h" className="mt-14">
        <h2 id="cats-h" className="text-3xl">Shop by category</h2>
        {cats.status === 'error' ? null : (
          <ul className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {(cats.data?.categories ?? Array.from({ length: 8 }, (_, i) => ({ slug: `s${i}`, skeleton: true }))).map((c) => (
              <li key={c.slug}>
                {c.skeleton ? <div className="skeleton h-20 rounded-3xl" /> : (
                  <Link to={`/products?category=${c.slug}`} className="flex min-h-20 flex-col justify-center rounded-3xl bg-peach px-5 py-3 ring-2 ring-transparent transition duration-200 hover:-translate-y-0.5 hover:ring-orange">
                    <span className="font-semibold">{c.label}</span>
                    <span className="text-xs text-muted">{formatCount(c.count)} products</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {SHELVES.map((shelf) => <Shelf key={shelf.slug} shelf={shelf} />)}
    </div>
  );
}
