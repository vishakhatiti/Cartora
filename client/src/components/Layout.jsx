import { Link, NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import SearchBox from './SearchBox.jsx';
import ThemeSwitcher from './ThemeSwitcher.jsx';
import UserMenu from './UserMenu.jsx';

function AccountArea() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="skeleton h-9 w-9 rounded-full" role="status" aria-label="Checking sign-in" />;
  if (user) return <UserMenu />;
  return (
    <NavLink
      to="/sign-in"
      className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-fg transition-transform hover:-translate-y-0.5"
    >
      Sign in
    </NavLink>
  );
}

export default function Layout() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-3 focus:py-2">
        Skip to content
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-display text-xl font-bold tracking-tight">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            Cartora
          </Link>
          <NavLink to="/products" className="hidden text-sm font-semibold text-muted hover:text-fg sm:block">All products</NavLink>
          <div className="order-last w-full sm:order-none sm:w-auto sm:min-w-0 sm:flex-1 sm:max-w-xl sm:mx-auto">
            <SearchBox />
          </div>
          <div className="ml-auto flex items-center gap-3">
            <ThemeSwitcher />
            <AccountArea />
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6 sm:py-12">
        <Outlet />
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-6xl px-4 py-5 text-sm text-muted sm:px-6">
          Built in the open on{' '}
          <a className="font-medium text-primary underline-offset-2 hover:underline" href="https://github.com/vishakhatiti/Cartora">
            GitHub
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
