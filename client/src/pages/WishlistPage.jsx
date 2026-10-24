import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { useWishlist } from '../context/WishlistContext.jsx';
import PageBand from '../components/PageBand.jsx';
import PriceTag from '../components/PriceTag.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

export default function WishlistPage() {
  const { user, status } = useAuth();
  const wishlist = useWishlist();
  const cart = useCart();
  const toast = useToast();
  const [busyId, setBusyId] = useState(null);

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/wishlist' }} replace />;

  const run = async (id, action, done) => {
    setBusyId(id);
    try { await action(); if (done) toast.success(done); } catch (err) { toast.error(err.message || 'Something went wrong. Please try again.'); } finally { setBusyId(null); }
  };
  const moveToCart = (p) => run(p.id, async () => { await cart.add(p.id, 1); await wishlist.remove(p.id); }, 'Moved to your cart.');

  return (
    <div className="settle">
      <PageBand title="Your wishlist" note={wishlist.count > 0 ? `${wishlist.count} saved item${wishlist.count === 1 ? '' : 's'}` : undefined} />
      <div className="mt-6">
        {wishlist.status === 'error' && <ErrorNotice error={wishlist.error} onRetry={wishlist.refresh} />}
        {wishlist.status === 'loading' && <div className="skeleton h-48 rounded-3xl" role="status" aria-label="Loading your wishlist" />}
        {wishlist.status === 'ready' && wishlist.count === 0 && (
          <section className="mx-auto max-w-lg rounded-3xl bg-peach p-8 text-center">
            <h2 className="text-3xl">Nothing saved yet</h2>
            <p className="mt-2 text-sm text-muted">Tap the heart on any product to keep it here.</p>
            <Link to="/products" className="mt-5 inline-block rounded-full bg-orange px-6 py-2.5 font-semibold text-orange-fg">Browse products</Link>
          </section>
        )}
        {wishlist.status === 'ready' && wishlist.count > 0 && (
          <ul className="space-y-3" aria-label="Saved products">
            {wishlist.items.map((p) => (
              <li key={p.id} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line-strong bg-surface p-4">
                <Link to={`/product/${p.id}`} className="shrink-0"><ProductImage product={p} size="large" alt="" className="h-24 w-24 rounded-2xl border border-line p-1" /></Link>
                <div className="min-w-0 flex-1 basis-48">
                  <Link to={`/product/${p.id}`} className="line-clamp-2 font-semibold hover:underline">{p.title}</Link>
                  {p.brand && <p className="text-xs text-muted">{p.brand}</p>}
                  <div className="mt-1"><PriceTag product={p} /></div>
                </div>
                <button type="button" disabled={busyId === p.id} onClick={() => moveToCart(p)} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg disabled:opacity-60">Move to cart</button>
                <button type="button" disabled={busyId === p.id} onClick={() => run(p.id, () => wishlist.remove(p.id))} aria-label={`Remove ${p.title} from wishlist`} className="rounded-full px-3 py-2 text-sm font-semibold text-bad hover:bg-pale disabled:opacity-60">Remove</button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
