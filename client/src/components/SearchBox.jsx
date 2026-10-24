import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { useRemote } from '../hooks/useRemote.js';

const DEBOUNCE_MS = 200;

/** Header search with autocomplete. Enter searches the text; picking a suggestion opens it. */
export default function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '');
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(-1);
  const listId = useId();
  const box = useRef(null);

  // Autocomplete: wait for a pause in typing, and drop answers that arrive late.
  useEffect(() => {
    const q = text.trim();
    if (q.length < 2) { setOptions([]); return undefined; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      catalogApi.suggestions(q, controller.signal)
        .then(({ products, categories }) => {
          setOptions([
            ...categories.map((c) => ({ key: `c-${c.slug}`, label: `${c.label}`, hint: 'Category', to: `/products?category=${c.slug}` })),
            ...products.map((p) => ({ key: `p-${p.id}`, label: p.title, hint: p.category, to: `/product/${p.id}` })),
          ]);
          setActive(-1);
        })
        .catch(() => setOptions([])); // suggestions are optional: failing quietly is right here
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [text]);

  useEffect(() => {
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const go = (to) => { setOpen(false); navigate(to); };
  const submit = (e) => {
    e.preventDefault();
    const q = text.trim();
    if (active >= 0 && options[active]) return go(options[active].to);
    const query = new URLSearchParams();
    if (q) query.set('q', q);
    if (category) query.set('category', category);
    const qs = query.toString();
    return go(qs ? `/products?${qs}` : '/products');
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const showList = open && options.length > 0;

  return (
    <form role="search" onSubmit={submit} ref={box} className="relative flex w-full items-stretch">
      <label htmlFor="search-category" className="sr-only">Search category</label>
      <select
        id="search-category"
        value={category}
        onChange={(e) => setCategory(e.target.value)}
        className="hidden max-w-36 shrink-0 rounded-l-xl border border-r-0 border-line-strong bg-pale px-2 text-sm font-medium text-fg sm:block"
      >
        <option value="">All</option>
        {(cats.data?.categories ?? []).map((c) => <option key={c.slug} value={c.slug}>{c.label}</option>)}
      </select>
      <div className="relative flex-1">
      <label htmlFor="site-search" className="sr-only">Search products</label>
      <input
        id="site-search"
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={text}
        onChange={(e) => { setText(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKeyDown}
        placeholder="Search 12,000 products"
        className="w-full rounded-xl border border-line-strong bg-cream py-2.5 pl-4 pr-20 text-sm text-fg placeholder:text-muted focus:border-primary sm:rounded-l-none"
      />
      <button type="submit" className="absolute right-1 top-1 bottom-1 rounded-lg bg-primary px-3.5 text-sm font-semibold text-primary-fg">Search</button>
      {showList && (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-40 mt-2 max-h-96 overflow-auto rounded-2xl border border-line bg-surface p-1 shadow-xl">
          {options.map((o, i) => (
            <li
              key={o.key}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); go(o.to); }}
              onMouseEnter={() => setActive(i)}
              className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-sm ${i === active ? 'bg-bg' : ''}`}
            >
              <span className="line-clamp-1">{o.label}</span>
              <span className="shrink-0 text-xs text-muted">{o.hint}</span>
            </li>
          ))}
        </ul>
      )}
      </div>
    </form>
  );
}
