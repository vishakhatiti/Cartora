import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { catalogApi } from '../lib/catalogApi.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
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
    <NavLink to="/sign-in" className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-fg">
      Sign in
    </NavLink>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-2 font-display text-2xl text-primary" aria-label="Cartora home">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span>Cartora</span>
    </Link>
  );
}

/** Second row: real category shortcuts. Scrolls sideways on narrow screens. */
function CategoryRow() {
  const cats = useRemote((signal) => catalogApi.categories(signal), []);
  const items = cats.data?.categories ?? [];
  return (
    <nav aria-label="Categories" className="border-t border-line bg-cream">
      <ul className="mx-auto flex max-w-7xl gap-1 overflow-x-auto px-4 py-1.5 text-sm sm:px-8">
        <li><NavLink to="/products" end className={({ isActive }) => `block whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold hover:bg-pale ${isActive ? 'text-primary' : ''}`}>All products</NavLink></li>
        {items.slice(0, 10).map((c) => (
          <li key={c.slug}><Link to={`/products?category=${c.slug}`} className="block whitespace-nowrap rounded-lg px-3 py-1.5 text-muted hover:bg-pale hover:text-primary">{c.label}</Link></li>
        ))}
      </ul>
    </nav>
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
      <header className="sticky top-0 z-30 border-b border-line bg-cream/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3 sm:px-8 md:flex-nowrap">
          <button type="button" onClick={() => setMenuOpen(true)} aria-label="Open menu" aria-haspopup="dialog" aria-expanded={menuOpen} className="grid h-10 w-10 place-items-center rounded-lg hover:bg-pale">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <Logo />
          <div className="order-last w-full md:order-none md:mx-3 md:w-auto md:max-w-2xl md:flex-1">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitcher />
            <AccountArea />
          </div>
        </div>
        <CategoryRow />
      </header>

      <NavDrawer open={menuOpen} onClose={() => setMenuOpen(false)} />

      <main id="main" className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8 sm:py-10">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
}
