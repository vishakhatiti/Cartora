import { Navigate, useParams, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { shelfBySlug } from '../lib/shelves.js';
import { useRemote } from '../hooks/useRemote.js';
import PageBand from '../components/PageBand.jsx';
import Pagination from '../components/Pagination.jsx';
import { ErrorNotice, ProductGrid, ProductGridSkeleton } from '../components/ProductCard.jsx';

/** Trending, Best sellers or New releases, with an optional category filter. The page and filter live in the URL. */
export default function ShelfPage({ slug }) {
  const shelf = shelfBySlug(slug);
  const [params, setParams] = useSearchParams();
  const category = params.get('category') ?? '';
  const page = Math.max(1, Number(params.get('page')) || 1);
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const { data, status, error, retry } = useRemote((signal) => catalogApi.discover(slug, { category, page, pageSize: 24 }, signal), [slug, category, page]);
  if (!shelf) return <Navigate to="/products" replace />;

  const update = (next) => {
    const merged = new URLSearchParams(params);
    for (const [k, v] of Object.entries(next)) { if (v) merged.set(k, v); else merged.delete(k); }
    setParams(merged);
  };

  return (
    <div className="settle">
      <PageBand title={shelf.title} note={data?.basis} />
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <label className="text-sm font-semibold">Category{' '}
          <select value={category} onChange={(e) => update({ category: e.target.value, page: '' })} className="ml-2 rounded-xl border border-line-strong bg-surface px-3 py-2 font-normal">
            <option value="">All categories</option>
            {(cats.data?.categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
          </select>
        </label>
        {data && <p className="text-sm text-muted" aria-live="polite">{data.total} products</p>}
      </div>
      <div className="mt-5">
        {status === 'error' && <ErrorNotice error={error} onRetry={retry} />}
        {status === 'loading' && !data && <ProductGridSkeleton count={8} />}
        {data && data.items.length === 0 && <p className="rounded-3xl bg-peach p-8 text-center text-muted">Nothing to show in this category yet.</p>}
        {data && data.items.length > 0 && <ProductGrid items={data.items} />}
      </div>
      {data && <div className="mt-8"><Pagination page={data.page} totalPages={data.totalPages} onPage={(n) => { update({ page: n > 1 ? String(n) : '' }); window.scrollTo?.(0, 0); }} /></div>}
    </div>
  );
}
