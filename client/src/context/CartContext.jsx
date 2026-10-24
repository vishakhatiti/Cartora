import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { commerceApi } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';

const CartContext = createContext(null);
const KEY = 'cartora-cart';
const EMPTY = { lines: [], totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0 }, issues: [], itemCount: 0 };

const SIGN_IN_MESSAGE = 'Sign in to add items to your cart.';

/** Older versions kept a guest cart in this browser. Carts now need an account, so any leftover is discarded. */
function clearLegacyGuestCart() {
  try { localStorage.removeItem(KEY); } catch { /* storage can be blocked; nothing to clear then */ }
}

/**
 * One cart for the whole app. The cart belongs to an account and is stored on the server, which prices it.
 * A visitor who is not signed in has an empty cart and cannot add to it.
 */
export function CartProvider({ children, api = commerceApi }) {
  const { user, status: authStatus } = useAuth();
  const [cart, setCart] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const userId = user?.id ?? null;

  const refresh = useCallback(async () => {
    try {
      setError(null);
      if (!userId) { setCart(EMPTY); setStatus('ready'); return; }
      setCart((await api.getCart()).cart);
      setStatus('ready');
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, [api, userId]);

  // Load when the visitor changes: first answer from /auth/me, sign-in, sign-out.
  useEffect(() => {
    if (authStatus !== 'ready') return;
    clearLegacyGuestCart();
    setStatus('loading');
    refresh();
  }, [authStatus, refresh]);

  const setQuantity = useCallback(async (productId, qty) => {
    if (!userId) throw new Error(SIGN_IN_MESSAGE);
    const { cart: next } = await api.setQuantity(productId, qty); // the badge changes only after the server agrees
    setCart(next);
  }, [api, userId]);

  const add = useCallback(async (productId, qty = 1) => {
    const existing = cart.lines.find((l) => l.productId === productId)?.qty ?? 0;
    await setQuantity(productId, Math.min(99, existing + qty));
  }, [cart.lines, setQuantity]);

  const remove = useCallback(async (productId) => {
    if (!userId) throw new Error(SIGN_IN_MESSAGE);
    setCart((await api.removeItem(productId)).cart);
  }, [api, userId]);

  // `api` is shared so checkout, payment and order pages use the same (replaceable) client as the cart
  const value = useMemo(() => ({ ...cart, api, status, error, refresh, add, setQuantity, remove }), [cart, api, status, error, refresh, add, setQuantity, remove]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
