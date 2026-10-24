import { useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { formatCount, formatDate } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import WishlistButton from '../components/WishlistButton.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import ProductImage from '../components/ProductImage.jsx';
import PriceTag from '../components/PriceTag.jsx';
import Stars from '../components/Stars.jsx';
import { ErrorNotice, ProductGrid } from '../components/ProductCard.jsx';

function Gallery({ product }) {
  const [index, setIndex] = useState(0);
  const count = product.images.length;
  return (
    <div>
      <ProductImage product={product} index={index} size="large" eager className="aspect-square w-full rounded-2xl border border-line p-4" />
      {count > 1 && (
        <ul className="mt-3 flex gap-2 overflow-x-auto pb-1" aria-label="Product photos">
          {product.images.map((_, i) => (
            <li key={i}>
              <button type="button" onClick={() => setIndex(i)} aria-label={`Show photo ${i + 1} of ${count}`} aria-pressed={i === index}
                className={`block overflow-hidden rounded-lg border-2 ${i === index ? 'border-primary' : 'border-line'}`}>
                <ProductImage product={product} index={i} size="thumb" alt="" className="h-16 w-16 p-1" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function AddToCart({ product }) {
  const outOfStock = product.stockQty != null && product.stockQty < 1;
  const cart = useCart();
  const toast = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [qty, setQty] = useState(1);
  const [busy, setBusy] = useState(false);
  const add = async () => {
    if (busy) return;
    if (!user) { // a cart belongs to an account: sign in first, then come back to this product
      toast.info('Sign in to add items to your cart.');
      navigate('/sign-in', { state: { from: location.pathname } });
      return;
    }
    setBusy(true);
    try {
      await cart.add(product.id, qty);
      toast.success(`Added ${qty} to your cart.`); // only after the cart really changed
    } catch (err) {
      toast.error(err.message || 'Could not add this to your cart. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="mt-5 flex flex-wrap items-center gap-4">
      {!outOfStock && <QtyStepper value={qty} onChange={setQty} disabled={busy} label="Quantity to add" max={Math.min(10, product.stockQty ?? 10)} />}
      <button type="button" onClick={add} disabled={busy || outOfStock} className="rounded-full bg-orange px-7 py-3 font-semibold text-orange-fg disabled:opacity-60">
        {outOfStock ? 'Out of stock' : busy ? 'Adding…' : 'Add to cart'}
      </button>
      <WishlistButton productId={product.id} title={product.title} label className="border border-line-strong" />
    </div>
  );
}

function RatingBreakdown({ breakdown, total }) {
  return (
    <ul className="space-y-1.5" aria-label="Rating breakdown">
      {[5, 4, 3, 2, 1].map((star) => {
        const n = breakdown[star] ?? 0;
        const pct = total ? Math.round((n / total) * 100) : 0;
        return (
          <li key={star} className="flex items-center gap-2 text-sm">
            <span className="w-12 shrink-0 text-muted">{star} star</span>
            <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden="true"><span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} /></span>
            <span className="w-16 shrink-0 text-right text-muted">{n} ({pct}%)</span>
          </li>
        );
      })}
    </ul>
  );
}

function Reviews({ productId, total }) {
  const [sort, setSort] = useState('recent');
  const [page, setPage] = useState(1);
  const { data, status, error, retry } = useRemote((signal) => catalogApi.reviews(productId, { sort, page, pageSize: 5 }, signal), [productId, sort, page]);
  return (
    <section aria-labelledby="reviews-h" className="mt-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="reviews-h" className="text-xl font-bold">Reviews ({formatCount(total)})</h2>
        {total > 1 && (
          <label className="text-sm text-muted">Sort{' '}
            <select value={sort} onChange={(e) => { setSort(e.target.value); setPage(1); }} className="ml-1 rounded-lg border border-line bg-surface px-2 py-1 text-fg">
              <option value="recent">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option>
            </select>
          </label>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">Reviews come from the product dataset. Reviews written on Cartora will appear here once they are added.</p>
      {status === 'error' && <div className="mt-4"><ErrorNotice error={error} onRetry={retry} /></div>}
      {total === 0 && <p className="mt-4 rounded-2xl border border-line bg-surface p-6 text-center text-muted">No reviews yet.</p>}
      {data && data.items.length > 0 && (
        <ul className="mt-4 divide-y divide-line rounded-2xl border border-line bg-surface">
          {data.items.map((r) => (
            <li key={r.id} className="p-4">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <Stars value={r.rating} />
                {r.title && <h3 className="font-sans font-semibold">{r.title}</h3>}
              </div>
              <p className="mt-1 text-xs text-muted">{r.reviewer}{r.createdAt ? ` · ${formatDate(r.createdAt)}` : ''}{r.verifiedPurchase ? ' · Verified purchase' : ''}</p>
              {r.text && <p className="mt-2 whitespace-pre-line text-sm">{r.text}</p>}
              {r.helpfulCount > 0 && <p className="mt-2 text-xs text-muted">{r.helpfulCount} found this helpful</p>}
            </li>
          ))}
        </ul>
      )}
      {data && data.totalPages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button type="button" disabled={page <= 1} onClick={() => setPage(page - 1)} className="rounded-xl border border-line bg-surface px-3 py-1.5 font-semibold disabled:opacity-40">Previous</button>
          <span className="text-muted">Page {data.page} of {data.totalPages}</span>
          <button type="button" disabled={page >= data.totalPages} onClick={() => setPage(page + 1)} className="rounded-xl border border-line bg-surface px-3 py-1.5 font-semibold disabled:opacity-40">Next</button>
        </div>
      )}
    </section>
  );
}

function Related({ id }) {
  const { data } = useRemote((signal) => catalogApi.related(id, signal), [id]);
  if (!data?.items?.length) return null; // a missing related row should never block the page
  return (
    <section aria-labelledby="related-h" className="mt-12">
      <h2 id="related-h" className="mb-4 text-xl font-bold">More like this</h2>
      <ProductGrid items={data.items.slice(0, 4)} />
    </section>
  );
}

export default function ProductPage() {
  const { id } = useParams();
  const { data, status, error, retry } = useRemote((signal) => catalogApi.product(id, signal), [id]);

  if (status === 'error') {
    if (error?.status === 404) {
      return (
        <section className="mx-auto max-w-md py-10 text-center">
          <h1 className="text-3xl font-extrabold">Product not found</h1>
          <p className="mt-2 text-muted">It may have been removed, or the link is wrong.</p>
          <Link to="/products" className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-fg">Browse products</Link>
        </section>
      );
    }
    return <ErrorNotice error={error} onRetry={retry} />;
  }
  if (!data?.product || data.product.id !== id) {
    return <div aria-busy="true" aria-label="Loading product" className="grid gap-8 md:grid-cols-2"><div className="skeleton aspect-square rounded-2xl" /><div className="space-y-3"><div className="skeleton h-8 w-3/4 rounded" /><div className="skeleton h-5 w-1/3 rounded" /><div className="skeleton h-10 w-40 rounded" /></div></div>;
  }

  const p = data.product;
  const specs = Object.entries(p.details ?? {});
  return (
    <article className="settle">
      <nav aria-label="Breadcrumb" className="mb-4 text-sm text-muted">
        <Link className="hover:text-fg" to="/products">All products</Link>{' / '}
        <Link className="hover:text-fg" to={`/products?category=${p.category.slug}`}>{p.category.label}</Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-2">
        <Gallery product={p} key={p.id} />
        <div>
          {p.brand && <Link to={`/products?brand=${encodeURIComponent(p.brand)}`} className="text-sm font-semibold uppercase tracking-wide text-primary hover:underline">{p.brand}</Link>}
          <h1 className="mt-1 text-2xl font-extrabold leading-snug sm:text-3xl">{p.title}</h1>
          <div className="mt-3"><Stars value={p.ratingAvg} count={p.ratingCount} /></div>
          <div className="mt-5"><PriceTag product={p} large /></div>
          {p.storeName && <p className="mt-2 text-sm">Sold by <strong>{p.storeName}</strong>{p.stockQty != null && (p.stockQty < 1 ? <span className="ml-2 font-semibold text-bad">Out of stock</span> : p.stockQty <= 5 ? <span className="ml-2 font-semibold text-warn">Only {p.stockQty} left</span> : <span className="ml-2 text-muted">In stock</span>)}</p>}
          <p className="mt-2 text-sm text-muted">Price in US dollars. Shipping is free on orders of $50.00 or more, otherwise $5.99.</p>
          <AddToCart product={p} />
          {p.features.length > 0 && (
            <section aria-labelledby="features-h" className="mt-6">
              <h2 id="features-h" className="text-lg font-bold">About this item</h2>
              <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{p.features.map((f, i) => <li key={i}>{f}</li>)}</ul>
            </section>
          )}
        </div>
      </div>

      {p.description && (
        <section aria-labelledby="desc-h" className="mt-10">
          <h2 id="desc-h" className="text-xl font-bold">Description</h2>
          <p className="mt-2 max-w-3xl whitespace-pre-line text-sm leading-relaxed">{p.description}</p>
        </section>
      )}

      {specs.length > 0 && (
        <section aria-labelledby="spec-h" className="mt-10">
          <h2 id="spec-h" className="text-xl font-bold">Specifications</h2>
          <dl className="mt-3 overflow-hidden rounded-2xl border border-line bg-surface text-sm">
            {specs.map(([k, v]) => (
              <div key={k} className="grid grid-cols-3 gap-3 border-b border-line px-4 py-2.5 last:border-b-0 sm:grid-cols-4">
                <dt className="font-semibold text-muted">{k}</dt><dd className="col-span-2 sm:col-span-3">{v}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      <section aria-labelledby="rb-h" className="mt-10">
        <h2 id="rb-h" className="text-xl font-bold">Customer ratings</h2>
        <div className="mt-3 max-w-md"><RatingBreakdown breakdown={p.ratingBreakdown} total={p.reviewCount} /></div>
        <p className="mt-2 text-xs text-muted">Breakdown is based on the {formatCount(p.reviewCount)} reviews in the dataset sample.</p>
      </section>

      <Reviews productId={p.id} total={p.reviewCount} />
      <Related id={p.id} />
    </article>
  );
}
