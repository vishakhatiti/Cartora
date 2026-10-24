import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { commerceApi } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const WishlistContext = createContext(null);
const EMPTY = { items: [], ids: [], count: 0 };

/** The signed-in user's saved products. Guests have none; saving asks them to sign in first. */
export function WishlistProvider({ children, api = commerceApi }) {
  const { user, status: authStatus } = useAuth();
  const userId = user?.id ?? null;
  const [list, setList] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (authStatus !== 'ready') return undefined;
    if (!userId) { setList(EMPTY); setStatus('ready'); return undefined; }
    let cancelled = false;
    setStatus('loading');
    api.getWishlist().then(({ wishlist }) => { if (!cancelled) { setList(wishlist); setStatus('ready'); } })
      .catch((err) => { if (!cancelled) { setError(err); setStatus('error'); } });
    return () => { cancelled = true; };
  }, [api, authStatus, userId, tick]);

  const refresh = useCallback(() => setTick((n) => n + 1), []);
  // The heart changes only after the server has confirmed the change.
  const add = useCallback(async (id) => setList((await api.addWishlist(id)).wishlist), [api]);
  const remove = useCallback(async (id) => setList((await api.removeWishlist(id)).wishlist), [api]);
  const has = useCallback((id) => list.ids.includes(id), [list.ids]);

  const value = useMemo(() => ({ ...list, status, error, refresh, add, remove, has }), [list, status, error, refresh, add, remove, has]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used inside WishlistProvider');
  return ctx;
}
