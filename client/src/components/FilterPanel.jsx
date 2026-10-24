import { useEffect, useState } from 'react';
import { formatCount } from '../lib/format.js';

const RATINGS = [4, 3, 2];

/** Facet sidebar. Every control writes to the URL through `onChange`, so results are linkable. */
export default function FilterPanel({ filters, categories, brands, onChange, onClear, activeCount }) {
  const [min, setMin] = useState(filters.minPrice);
  const [max, setMax] = useState(filters.maxPrice);
  useEffect(() => { setMin(filters.minPrice); setMax(filters.maxPrice); }, [filters.minPrice, filters.maxPrice]);

  const selectedBrands = filters.brand ? filters.brand.split(',') : [];
  const toggleBrand = (name) => {
    const next = selectedBrands.includes(name) ? selectedBrands.filter((b) => b !== name) : [...selectedBrands, name];
    onChange({ brand: next.join(',') });
  };
  const applyPrice = (e) => {
    e.preventDefault();
    onChange({ minPrice: min.trim(), maxPrice: max.trim() });
  };
  const heading = 'text-sm font-bold uppercase tracking-wide text-muted';

  return (
    <div className="space-y-6">
      {activeCount > 0 && (
        <button type="button" onClick={onClear} className="text-sm font-semibold text-primary underline-offset-2 hover:underline">
          Clear all filters ({activeCount})
        </button>
      )}

      <section aria-labelledby="f-cat">
        <h2 id="f-cat" className={heading}>Category</h2>
        <ul className="mt-2 space-y-0.5">
          <li>
            <button type="button" onClick={() => onChange({ category: '' })} aria-pressed={!filters.category}
              className={`w-full rounded-lg px-2 py-1 text-left text-sm ${!filters.category ? 'bg-bg font-bold' : 'hover:bg-bg'}`}>All categories</button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button type="button" onClick={() => onChange({ category: c.slug })} aria-pressed={filters.category === c.slug}
                className={`flex w-full justify-between gap-2 rounded-lg px-2 py-1 text-left text-sm ${filters.category === c.slug ? 'bg-bg font-bold' : 'hover:bg-bg'}`}>
                <span>{c.label}</span><span className="text-muted">{formatCount(c.count)}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="f-price">
        <h2 id="f-price" className={heading}>Price (USD)</h2>
        <form onSubmit={applyPrice} className="mt-2 flex items-end gap-2">
          <label className="flex-1 text-xs text-muted">Min
            <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg" />
          </label>
          <label className="flex-1 text-xs text-muted">Max
            <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className="mt-0.5 w-full rounded-lg border border-line bg-surface px-2 py-1.5 text-sm text-fg" />
          </label>
          <button type="submit" className="rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-fg">Go</button>
        </form>
      </section>

      <section aria-labelledby="f-rate">
        <h2 id="f-rate" className={heading}>Rating</h2>
        <ul className="mt-2 space-y-0.5">
          {RATINGS.map((r) => (
            <li key={r}>
              <button type="button" onClick={() => onChange({ minRating: filters.minRating === String(r) ? '' : String(r) })} aria-pressed={filters.minRating === String(r)} aria-label={`${r} stars and up`}
                className={`w-full rounded-lg px-2 py-1 text-left text-sm ${filters.minRating === String(r) ? 'bg-bg font-bold' : 'hover:bg-bg'}`}>
                <span className="text-accent" aria-hidden="true">{'★'.repeat(r)}</span><span aria-hidden="true"> &amp; up</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {brands.length > 0 && (
        <section aria-labelledby="f-brand">
          <h2 id="f-brand" className={heading}>Brand</h2>
          <ul className="mt-2 max-h-56 space-y-1 overflow-auto pr-1">
            {brands.map((b) => (
              <li key={b.name}>
                <label className="flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedBrands.includes(b.name)} onChange={() => toggleBrand(b.name)} className="accent-[var(--primary)]" />
                  <span className="flex-1">{b.name}</span><span className="text-muted">{formatCount(b.count)}</span>
                </label>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
