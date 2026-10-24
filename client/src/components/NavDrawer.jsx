import { Link, useNavigate } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import Drawer from './Drawer.jsx';

const item = 'block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-pale';

/** The slide-out menu: greeting, browse links, every category, and account links. */
export default function NavDrawer({ open, onClose }) {
  const { user, signOut } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const cats = useRemote((signal) => catalogApi.categories(signal), []);

  const handleSignOut = async () => {
    onClose();
    try {
      await signOut();
      toast.info('You are signed out.');
      navigate('/');
    } catch {
      toast.error('Could not sign out. Please try again.');
    }
  };

  return (
    <Drawer open={open} onClose={onClose} title={user ? `Hello, ${user.name.trim().split(/\s+/)[0]}` : 'Hello, guest'}>
      <nav aria-label="Menu" className="flex-1 space-y-5 p-3">
        <section aria-labelledby="dw-mode">
          <h2 id="dw-mode" className="px-3 pb-1 font-sans text-xs font-bold uppercase tracking-wide text-muted">Mode</h2>
          <div className="px-3">
            <div className="inline-flex gap-1 rounded-full bg-hero p-1">
              <Link to="/" onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-hero-fg hover:bg-hero-fg/10">Buying</Link>
              <Link to="/sell" onClick={onClose} className="rounded-full px-4 py-1.5 text-sm font-semibold text-hero-fg hover:bg-hero-fg/10">Selling</Link>
            </div>
          </div>
        </section>

        <section aria-labelledby="dw-browse">
          <h2 id="dw-browse" className="px-3 pb-1 font-sans text-xs font-bold uppercase tracking-wide text-muted">Browse</h2>
          <Link to="/" onClick={onClose} className={item}>Home</Link>
          <Link to="/products" onClick={onClose} className={item}>All products</Link>
          <Link to="/trending" onClick={onClose} className={item}>Trending now</Link>
          <Link to="/best-sellers" onClick={onClose} className={item}>Best sellers</Link>
          <Link to="/new-releases" onClick={onClose} className={item}>New releases</Link>
          <Link to="/wishlist" onClick={onClose} className={item}>Wishlist</Link>
          <Link to="/orders" onClick={onClose} className={item}>Your orders</Link>
          <Link to="/help" onClick={onClose} className={item}>Customer service</Link>
          <Link to="/cart" onClick={onClose} className={item}>Cart</Link>
        </section>

        <section aria-labelledby="dw-cats">
          <h2 id="dw-cats" className="px-3 pb-1 font-sans text-xs font-bold uppercase tracking-wide text-muted">Shop by category</h2>
          {cats.status === 'loading' && <p className="px-3 py-2 text-sm text-muted">Loading categories…</p>}
          {cats.status === 'error' && <p className="px-3 py-2 text-sm text-muted">Categories could not be loaded. <button type="button" onClick={cats.retry} className="font-semibold text-primary underline">Retry</button></p>}
          {cats.data?.categories.map((c) => (
            <Link key={c.slug} to={`/products?category=${c.slug}`} onClick={onClose} className={item}>{c.label}</Link>
          ))}
        </section>

        <section aria-labelledby="dw-acct">
          <h2 id="dw-acct" className="px-3 pb-1 font-sans text-xs font-bold uppercase tracking-wide text-muted">Account</h2>
          {user ? (
            <>
              <Link to="/account" onClick={onClose} className={item}>Your account</Link>
              <button type="button" onClick={handleSignOut} className={`${item} w-full text-left`}>Sign out</button>
            </>
          ) : (
            <>
              <Link to="/sign-in" onClick={onClose} className={item}>Sign in</Link>
              <Link to="/register" onClick={onClose} className={item}>Create account</Link>
            </>
          )}
        </section>
      </nav>
    </Drawer>
  );
}
