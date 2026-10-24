import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { useCart } from '../context/CartContext.jsx';

/** Bell with an unread count. Refreshes when the page changes and when the tab regains focus. Signed-in users only. */
export default function NotificationBell() {
  const { api } = useCart();
  const { pathname } = useLocation();
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  const load = useCallback(async () => {
    try { setData(await api.notifications()); setFailed(false); } catch { setFailed(true); }
  }, [api]);

  useEffect(() => { load(); }, [load, pathname]);
  useEffect(() => {
    window.addEventListener('focus', load);
    return () => window.removeEventListener('focus', load);
  }, [load]);
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const markRead = async () => {
    try { setData(await api.markNotificationsRead()); } catch { setFailed(true); }
  };

  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        aria-label={data.unread > 0 ? `Notifications, ${data.unread} unread` : 'Notifications'}
        className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-hero-fg/10">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
        {data.unread > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-orange px-1 text-xs font-bold text-orange-fg">{data.unread > 9 ? '9+' : data.unread}</span>}
      </button>
      {open && (
        <div role="dialog" aria-label="Notifications" className="absolute right-0 z-40 mt-2 w-80 max-w-[90vw] rounded-2xl border border-line bg-surface p-2 text-fg shadow-lg">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="font-semibold">Notifications</p>
            {data.unread > 0 && <button type="button" onClick={markRead} className="text-sm font-semibold text-primary hover:underline">Mark all read</button>}
          </div>
          {failed && <p className="px-3 py-2 text-sm text-muted">Could not refresh notifications.</p>}
          {data.items.length === 0 && !failed && <p className="px-3 py-6 text-center text-sm text-muted">Nothing new yet.</p>}
          {data.items.length > 0 && (
            <ul className="max-h-96 overflow-y-auto">
              {data.items.map((n) => (
                <li key={n.id}>
                  <Link to={n.link ?? '/'} onClick={() => setOpen(false)} className={`block rounded-xl px-3 py-2 text-sm hover:bg-pale ${n.read ? '' : 'bg-bg'}`}>
                    <span className="flex items-center gap-2 font-semibold">{!n.read && <span aria-label="Unread" className="h-2 w-2 rounded-full bg-orange" />}{n.title}</span>
                    <span className="block text-muted">{n.message}</span>
                    <span className="block text-xs text-muted">{formatDate(n.createdAt)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
