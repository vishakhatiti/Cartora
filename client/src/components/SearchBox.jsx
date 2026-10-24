import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';

const DEBOUNCE_MS = 200;

/** Header search with autocomplete. Enter searches the text; picking a suggestion opens it. */
export default function SearchBox() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [text, setText] = useState(params.get('q') ?? '');
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
    return go(q ? `/products?q=${encodeURIComponent(q)}` : '/products');
  };
  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((i) => Math.min(i + 1, options.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(i - 1, -1)); }
    else if (e.key === 'Escape') setOpen(false);
  };
  const showList = open && options.length > 0;

  return (
    <form role="search" onSubmit={submit} ref={box} className="relative w-full">
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
        className="w-full rounded-full border border-line bg-surface py-2 pl-4 pr-20 text-sm placeholder:text-muted focus:border-primary"
      />
      <button type="submit" className="absolute right-1 top-1 rounded-full bg-primary px-3.5 py-1 text-sm font-semibold text-primary-fg">Search</button>
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
    </form>
  );
}
