import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { SHELVES } from '../lib/shelves.js';
import ModeSwitch from './ModeSwitch.jsx';
import Footer from './Footer.jsx';
import NavDrawer from './NavDrawer.jsx';
import SearchBox from './SearchBox.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import UserMenu from './UserMenu.jsx';

function AccountArea() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="skeleton h-9 w-9 rounded-full" role="status" aria-label="Checking sign-in" />;
  if (user) return <UserMenu />;
  return (
    <NavLink to="/sign-in" className="rounded-full bg-orange px-4 py-2 text-sm font-semibold text-orange-fg">
      Sign in
    </NavLink>
  );
}

function CartLink() {
  const { itemCount } = useCart();
  return (
    <Link to="/cart" aria-label={itemCount > 0 ? `Cart, ${itemCount} item${itemCount === 1 ? '' : 's'}` : 'Cart'} className="relative grid h-10 w-10 place-items-center rounded-lg hover:bg-hero-fg/10">
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 4h2l2.4 11.2a1 1 0 0 0 1 .8h8.8a1 1 0 0 0 1-.8L20 8H6" /><circle cx="9" cy="20" r="1.2" /><circle cx="17" cy="20" r="1.2" /></svg>
      {itemCount > 0 && <span aria-hidden="true" className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-orange px-1 text-xs font-bold text-orange-fg">{itemCount > 99 ? '99+' : itemCount}</span>}
    </Link>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-2xl text-hero-fg" aria-label="Cartora home">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span>Cartora</span>
    </Link>
  );
}

/** Second row: the Buying/Selling switch, then real category shortcuts (or the store name when selling). */
function SecondRow() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const selling = pathname === '/sell' || pathname.startsWith('/sell/');
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const items = cats.data?.categories ?? [];
  const pill = 'block whitespace-nowrap rounded-full px-3 py-1.5 text-sm text-hero-fg/85 hover:bg-hero-fg/10 hover:text-hero-fg';
  return (
    <div className="border-t border-hero-fg/10">
      <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2 sm:px-8">
        <ModeSwitch />
        {selling ? (
          <p className="truncate text-sm text-hero-fg/85">Seller workspace{user?.storeName ? ` · ${user.storeName}` : ''}</p>
        ) : (
          <nav aria-label="Categories" className="min-w-0 flex-1">
            <ul className="flex gap-1 overflow-x-auto">
              {SHELVES.map((sh) => <li key={sh.slug}><NavLink to={`/${sh.slug}`} className={({ isActive }) => `${pill} font-semibold ${isActive ? 'bg-hero-fg/10 text-hero-fg' : ''}`}>{sh.short}</NavLink></li>)}
              <li><NavLink to="/products" end className={({ isActive }) => `${pill} font-semibold ${isActive ? 'bg-hero-fg/10 text-hero-fg' : ''}`}>All products</NavLink></li>
              {items.slice(0, 10).map((c) => (
                <li key={c.slug}><Link to={`/products?category=${c.slug}`} className={pill}>{c.label}</Link></li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );
}

export default function Layout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();
  useEffect(() => setMenuOpen(false), [pathname]);

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 bg-hero text-hero-fg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8 md:flex-nowrap">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-hero-fg/10">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Logo />
          <div className="order-last w-full md:order-none md:mx-3 md:w-auto md:max-w-2xl md:flex-1">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitcher />
            <CartLink />
            <AccountArea />
          </div>
        </div>
        <SecondRow />
      </header>

      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
