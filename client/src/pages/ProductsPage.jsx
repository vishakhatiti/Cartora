import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { formatCount } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import FilterPanel from '../components/FilterPanel.jsx';
import Pagination from '../components/Pagination.jsx';
import { ErrorNotice, ProductGrid, ProductGridSkeleton } from '../components/ProductCard.jsx';

const SORTS = [
  ['relevance', 'Most relevant'],
  ['rating', 'Highest rated'],
  ['price_asc', 'Price: low to high'],
  ['price_desc', 'Price: high to low'],
];
const FILTER_KEYS = ['category', 'brand', 'minPrice', 'maxPrice', 'minRating'];
const PAGE_SIZE = 24;

/** Search and browse. Every filter, the sort and the page live in the URL. */
export default function ProductsPage() {
  const [params, setParams] = useSearchParams();
  const filters = useMemo(() => ({
    q: params.get('q') ?? '',
    category: params.get('category') ?? '',
    brand: params.get('brand') ?? '',
    minPrice: params.get('minPrice') ?? '',
    maxPrice: params.get('maxPrice') ?? '',
    minRating: params.get('minRating') ?? '',
    sort: params.get('sort') ?? 'relevance',
    page: Math.max(1, Number.parseInt(params.get('page') ?? '1', 10) || 1),
  }), [params]);

  const update = (patch) => {
    const next = new URLSearchParams(params);
    for (const [key, value] of Object.entries(patch)) {
      if (value === '' || value == null) next.delete(key); else next.set(key, String(value));
    }
    if (!('page' in patch)) next.delete('page'); // any filter change goes back to page 1
    setParams(next);
    if ('page' in patch) window.scrollTo?.({ top: 0 });
  };
  const clear = () => {
    const next = new URLSearchParams();
    if (filters.q) next.set('q', filters.q);
    setParams(next);
  };

  const listKey = params.toString();
  const results = useRemote((signal) => catalogApi.products({ ...filters, pageSize: PAGE_SIZE }, signal), [listKey]);
  const cats = useRemote((signal) => catalogApi.categories(signal), []);

  const categoryList = useMemo(() => {
    const all = cats.data?.categories ?? [];
    if (!filters.q) return all;
    // With a text search, only list categories that have matches, with the counts for this search.
    const counts = new Map((results.data?.facets.categories ?? []).map((c) => [c.slug, c.count]));
    return all.filter((c) => counts.has(c.slug)).map((c) => ({ ...c, count: counts.get(c.slug) }));
  }, [cats.data, results.data, filters.q]);

  const activeCount = FILTER_KEYS.filter((k) => filters[k]).length;
  const data = results.data;
  const categoryLabel = cats.data?.categories.find((c) => c.slug === filters.category)?.label;
  const title = filters.q ? `Results for “${filters.q}”` : categoryLabel ?? 'All products';

  return (
    <div className="settle">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">{title}</h1>
          <p className="mt-1 text-sm text-muted" aria-live="polite">
            {results.status === 'error' ? '' : data ? `${formatCount(data.total)} ${data.total === 1 ? 'product' : 'products'}` : 'Loading…'}
          </p>
        </div>
        <label className="text-sm text-muted">Sort by{' '}
          <select value={filters.sort} onChange={(e) => update({ sort: e.target.value === 'relevance' ? '' : e.target.value })}
            className="ml-1 rounded-lg border border-line bg-surface px-2 py-1.5 text-fg">
            {SORTS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[16rem_1fr]">
        <aside aria-label="Filters">
          <details className="rounded-2xl border border-line bg-surface p-4 lg:hidden">
            <summary className="cursor-pointer font-semibold">Filters{activeCount ? ` (${activeCount})` : ''}</summary>
            <div className="mt-4">
              <FilterPanel filters={filters} categories={categoryList} brands={data?.facets.brands.slice(0, 15) ?? []} onChange={update} onClear={clear} activeCount={activeCount} />
            </div>
          </details>
          <div className="hidden rounded-2xl border border-line bg-surface p-4 lg:block">
            <FilterPanel filters={filters} categories={categoryList} brands={data?.facets.brands.slice(0, 15) ?? []} onChange={update} onClear={clear} activeCount={activeCount} />
          </div>
        </aside>

        <section aria-label="Products">
          {results.status === 'error' && <ErrorNotice error={results.error} onRetry={results.retry} />}
          {results.status === 'loading' && !data && <ProductGridSkeleton count={8} />}
          {data && data.items.length === 0 && (
            <div className="rounded-2xl border border-line bg-surface p-8 text-center">
              <p className="font-semibold">No products match.</p>
              <p className="mt-1 text-sm text-muted">Try fewer filters or a different word.</p>
              {(activeCount > 0 || filters.q) && <button type="button" onClick={() => setParams(new URLSearchParams())} className="mt-4 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">Start over</button>}
            </div>
          )}
          {data && data.items.length > 0 && (
            <div className={results.status === 'loading' ? 'opacity-60 transition-opacity' : ''}>
              <ProductGrid items={data.items} />
              <Pagination page={data.page} totalPages={data.totalPages} onPage={(n) => update({ page: n })} />
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
