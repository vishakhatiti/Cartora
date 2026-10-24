/** Page links as buttons: the page lives in the URL, so the parent changes it through onPage. */
export default function Pagination({ page, totalPages, onPage }) {
  if (totalPages <= 1) return null;
  const pages = new Set([1, totalPages, page - 1, page, page + 1]);
  const list = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const btn = 'grid min-h-10 min-w-10 place-items-center rounded-full border px-3 text-sm font-semibold transition-colors';
  const items = [];
  list.forEach((n, i) => {
    if (i > 0 && n - list[i - 1] > 1) items.push(<li key={`gap-${n}`} aria-hidden="true" className="px-1 text-muted">…</li>);
    items.push(
      <li key={n}>
        <button
          type="button"
          onClick={() => onPage(n)}
          aria-current={n === page ? 'page' : undefined}
          aria-label={`Page ${n}`}
          className={`${btn} ${n === page ? 'border-orange bg-orange text-orange-fg' : 'border-line-strong bg-surface hover:border-orange'}`}
        >{n}</button>
      </li>,
    );
  });
  return (
    <nav aria-label="Pagination" className="mt-8">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        <li><button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className={`${btn} border-line bg-surface disabled:opacity-40`}>Previous</button></li>
        {items}
        <li><button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className={`${btn} border-line bg-surface disabled:opacity-40`}>Next</button></li>
      </ul>
    </nav>
  );
}
