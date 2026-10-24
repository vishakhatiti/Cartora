import { useEffect, useState } from 'react';
import { formatCount } from '../lib/format.js';

const RATINGS = [4, 3, 2];
const pill = 'flex w-full items-center justify-between gap-2 rounded-full px-3 py-1.5 text-left text-sm transition-colors';
const selected = 'bg-orange font-semibold text-orange-fg';
const idle = 'hover:bg-pale';

function Section({ id, title, children }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="text-xl">{title}</h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/** Filter sidebar. Every control writes to the URL through `onChange`, so results are linkable. */
export default function FilterPanel({ filters, categories, brands, onChange }) {
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
  const field = 'mt-0.5 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-fg';

  return (
    <div className="space-y-7">
      <Section id="f-cat" title="Product categories">
        <ul className="space-y-0.5 rounded-2xl border border-line-strong bg-cream p-2">
          <li>
            <button type="button" onClick={() => onChange({ category: '' })} aria-pressed={!filters.category} className={`${pill} ${!filters.category ? selected : idle}`}>
              All products
            </button>
          </li>
          {categories.map((c) => (
            <li key={c.slug}>
              <button type="button" onClick={() => onChange({ category: c.slug })} aria-pressed={filters.category === c.slug} className={`${pill} ${filters.category === c.slug ? selected : idle}`}>
                <span>{c.label}</span><span className={filters.category === c.slug ? '' : 'text-muted'}>{formatCount(c.count)}</span>
              </button>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="f-price" title="Pricing (USD)">
        <form onSubmit={applyPrice} className="flex items-end gap-2 rounded-2xl border border-line-strong bg-cream p-3">
          <label className="flex-1 text-xs text-muted">Min
            <input inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} className={field} />
          </label>
          <label className="flex-1 text-xs text-muted">Max
            <input inputMode="decimal" value={max} onChange={(e) => setMax(e.target.value)} className={field} />
          </label>
          <button type="submit" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">Go</button>
        </form>
      </Section>

      <Section id="f-rate" title="Rating">
        <ul className="space-y-0.5 rounded-2xl border border-line-strong bg-cream p-2">
          {RATINGS.map((r) => {
            const on = filters.minRating === String(r);
            return (
              <li key={r}>
                <button type="button" onClick={() => onChange({ minRating: on ? '' : String(r) })} aria-pressed={on} aria-label={`${r} stars and up`} className={`${pill} ${on ? selected : idle}`}>
                  <span aria-hidden="true"><span className={on ? '' : 'text-accent'}>{'★'.repeat(r)}</span> &amp; up</span>
                </button>
              </li>
            );
          })}
        </ul>
      </Section>

      {brands.length > 0 && (
        <Section id="f-brand" title="Brand">
          <ul className="flex max-h-60 flex-wrap gap-2 overflow-auto rounded-2xl border border-line-strong bg-cream p-3">
            {brands.map((b) => {
              const on = selectedBrands.includes(b.name);
              return (
                <li key={b.name}>
                  <label className={`flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-primary ${on ? 'border-orange bg-orange text-orange-fg' : 'border-line-strong bg-surface hover:bg-pale'}`}>
                    <input type="checkbox" checked={on} onChange={() => toggleBrand(b.name)} className="sr-only" />
                    <span>{b.name}</span><span className={on ? '' : 'text-muted'}>{b.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </Section>
      )}
    </div>
  );
}
