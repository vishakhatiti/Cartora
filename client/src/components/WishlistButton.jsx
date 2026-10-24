import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';

/** Heart toggle. `label` shows text next to the icon (product page); cards show the icon only. */
export default function WishlistButton({ productId, title, label = false, className = '' }) {
  const { user } = useAuth();
  const wishlist = useWishlist();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [busy, setBusy] = useState(false);
  const saved = wishlist.has(productId);

  const toggle = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast.info('Sign in to save products to your wishlist.');
      navigate('/sign-in', { state: { from: location.pathname + location.search } });
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      if (saved) { await wishlist.remove(productId); toast.info('Removed from your wishlist.'); }
      else { await wishlist.add(productId); toast.success('Saved to your wishlist.'); }
    } catch (err) {
      toast.error(err.message || 'Could not update your wishlist. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button type="button" onClick={toggle} disabled={busy} aria-pressed={saved}
      aria-label={saved ? `Remove ${title} from wishlist` : `Save ${title} to wishlist`}
      className={`inline-flex items-center gap-2 rounded-full bg-surface/95 text-fg shadow transition hover:scale-105 disabled:opacity-60 ${label ? 'px-5 py-3 font-semibold' : 'h-9 w-9 justify-center'} ${className}`}>
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill={saved ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={saved ? 'text-orange' : ''}>
        <path d="M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5.5 6.2 5.5c1.9 0 3.3 1 3.8 2 .5-1 1.9-2 3.8-2 3.2 0 5 3.1 3.7 6.3C19.5 16.4 12 21 12 21z" />
      </svg>
      {label && <span>{saved ? 'Saved' : 'Save for later'}</span>}
    </button>
  );
}
