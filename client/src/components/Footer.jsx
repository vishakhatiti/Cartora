import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

const link = 'text-sm text-hero-fg/80 underline-offset-2 hover:text-primary hover:underline';

/** Pastel gradient footer. Only links to pages that exist; no invented address, phone number or socials. */
export default function Footer() {
  const { user } = useAuth();
  return (
    <footer className="mt-8 rounded-t-3xl bg-linear-to-br from-hero to-hero-2 text-hero-fg">
      <div aria-hidden="true" className="h-1 rounded-t-3xl bg-linear-to-r from-primary via-coral to-accent" />
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:grid-cols-3 sm:px-8">
        <div>
          <p className="font-display text-2xl">Cartora</p>
          <p className="mt-2 max-w-xs text-sm text-hero-fg/80">A calmer marketplace: real products, honest prices, and one account for buying and selling.</p>
        </div>
        <nav aria-label="Shop">
          <h2 className="font-sans text-xs font-bold uppercase tracking-wide text-hero-fg/70">Shop</h2>
          <ul className="mt-3 space-y-2">
            <li><Link className={link} to="/products">All products</Link></li>
            <li><Link className={link} to="/trending">Trending now</Link></li>
            <li><Link className={link} to="/best-sellers">Best sellers</Link></li>
            <li><Link className={link} to="/new-releases">New releases</Link></li>
          </ul>
        </nav>
        <nav aria-label="Account and project">
          <h2 className="font-sans text-xs font-bold uppercase tracking-wide text-hero-fg/70">Account</h2>
          <ul className="mt-3 space-y-2">
            {user ? (
              <li><Link className={link} to="/account">Your account</Link></li>
            ) : (
              <>
                <li><Link className={link} to="/sign-in">Sign in</Link></li>
                <li><Link className={link} to="/register">Create account</Link></li>
              </>
            )}
            <li><Link className={link} to="/orders">Your orders</Link></li>
            <li><Link className={link} to="/wishlist">Wishlist</Link></li>
            <li><Link className={link} to="/help">Customer service</Link></li>
            <li><Link className={link} to="/sell">Sell on Cartora</Link></li>
          </ul>
        </nav>
      </div>
      <p className="mx-auto max-w-7xl border-t border-hero-fg/10 px-4 py-4 text-xs text-hero-fg/70 sm:px-8">© {new Date().getFullYear()} Cartora. Prices are in US dollars.</p>
    </footer>
  );
}
