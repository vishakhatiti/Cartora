import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { commerceApi } from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const CartContext = createContext(null);
const KEY = 'cartora-cart';
const EMPTY = { lines: [], totals: { subtotalCents: 0, shippingCents: 0, totalCents: 0 }, issues: [], itemCount: 0 };

/** The guest cart lives in this browser as product ids and quantities only. Storage can be blocked, so every access is guarded. */
export function readGuestItems() {
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((i) => i && typeof i.productId === 'string' && Number.isInteger(i.qty) && i.qty > 0) : [];
  } catch {
    return [];
  }
}
function writeGuestItems(items) {
  try {
    if (items.length === 0) localStorage.removeItem(KEY); else localStorage.setItem(KEY, JSON.stringify(items));
    return true;
  } catch {
    return false;
  }
}

/**
 * One cart for the whole app. Guests: ids and quantities in this browser, priced by the server (POST /cart/quote).
 * Signed in: the cart is stored on the server. When a guest signs in, the browser cart is merged into the account
 * cart, and it is cleared from the browser only after the server confirms the merge.
 */
export function CartProvider({ children, api = commerceApi }) {
  const { user, status: authStatus } = useAuth();
  const toast = useToast();
  const [cart, setCart] = useState(EMPTY);
  const [status, setStatus] = useState('loading'); // loading | ready | error
  const [error, setError] = useState(null);
  const guestItems = useRef(readGuestItems());
  const userId = user?.id ?? null;

  const loadGuest = useCallback(async () => {
    guestItems.current = readGuestItems();
    if (guestItems.current.length === 0) { setCart(EMPTY); setStatus('ready'); return; }
    const { cart: priced } = await api.quote(guestItems.current);
    setCart(priced);
    setStatus('ready');
  }, [api]);

  const refresh = useCallback(async () => {
    try {
      setError(null);
      if (userId) { setCart((await api.getCart()).cart); setStatus('ready'); } else await loadGuest();
    } catch (err) {
      setError(err);
      setStatus('error');
    }
  }, [api, userId, loadGuest]);

  // Load when the visitor changes: first answer from /auth/me, sign-in, sign-out.
  useEffect(() => {
    if (authStatus !== 'ready') return;
    let cancelled = false;
    (async () => {
      setStatus('loading');
      try {
        if (!userId) { await loadGuest(); return; }
        const local = readGuestItems();
        if (local.length > 0) {
          try {
            const result = await api.merge(local);
            writeGuestItems([]); // only now that the server has the items
            guestItems.current = [];
            if (!cancelled) {
              setCart(result.cart);
              setStatus('ready');
              if (result.skipped.length > 0) toast.info(`${result.skipped.length} item${result.skipped.length === 1 ? '' : 's'} from your browser cart could not be added (unavailable or over the quantity limit).`);
              else toast.success('Your browser cart was added to your account.');
            }
            return;
          } catch {
            toast.error('We could not add your browser cart to your account yet. It is still saved on this device.');
          }
        }
        const { cart: serverCart } = await api.getCart();
        if (!cancelled) { setCart(serverCart); setStatus('ready'); }
      } catch (err) {
        if (!cancelled) { setError(err); setStatus('error'); }
      }
    })();
    return () => { cancelled = true; };
    // toast is stable; api and userId are the real triggers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus, userId, api]);

  const setQuantity = useCallback(async (productId, qty) => {
    if (userId) {
      const { cart: next } = await api.setQuantity(productId, qty); // the badge changes only after the server agrees
      setCart(next);
      return;
    }
    const items = readGuestItems().filter((i) => i.productId !== productId);
    items.push({ productId, qty });
    if (!writeGuestItems(items)) throw new Error('Your browser is blocking storage, so the cart cannot be saved here.');
    await loadGuest();
  }, [api, userId, loadGuest]);

  const add = useCallback(async (productId, qty = 1) => {
    const existing = cart.lines.find((l) => l.productId === productId)?.qty ?? 0;
    await setQuantity(productId, Math.min(99, existing + qty));
  }, [cart.lines, setQuantity]);

  const remove = useCallback(async (productId) => {
    if (userId) { setCart((await api.removeItem(productId)).cart); return; }
    writeGuestItems(readGuestItems().filter((i) => i.productId !== productId));
    await loadGuest();
  }, [api, userId, loadGuest]);

  // `api` is shared so checkout, payment and order pages use the same (replaceable) client as the cart
  const value = useMemo(() => ({ ...cart, api, status, error, refresh, add, setQuantity, remove }), [cart, api, status, error, refresh, add, setQuantity, remove]);
  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
