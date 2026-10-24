import { Link } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { useRemote } from '../hooks/useRemote.js';
import { ErrorNotice, ProductGrid, ProductGridSkeleton } from './ProductCard.jsx';

/** A short row of ranked products with a link to the full shelf page. */
export default function Shelf({ shelf, count = 4 }) {
  const { data, status, error, retry } = useRemote((signal) => catalogApi.discover(shelf.slug, { pageSize: count }, signal), [shelf.slug, count]);
  if (status === 'ready' && data?.items.length === 0) return null; // an empty shelf is hidden, not shown as a broken row
  return (
    <section aria-labelledby={`shelf-${shelf.slug}`} className="mt-14">
      <div className="flex items-end justify-between gap-3">
        <h2 id={`shelf-${shelf.slug}`} className="text-3xl">{shelf.title}</h2>
        <Link to={`/${shelf.slug}`} className="text-sm font-semibold text-primary hover:underline">See all</Link>
      </div>
      <div className="mt-5">
        {status === 'error' && <ErrorNotice error={error} onRetry={retry} />}
        {status === 'loading' && !data && <ProductGridSkeleton count={count} />}
        {data && <ProductGrid items={data.items} />}
      </div>
    </section>
  );
}
