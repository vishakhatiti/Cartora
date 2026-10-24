import { Link, useLocation } from 'react-router-dom';

/**
 * Buying / Selling switch for one account. The mode is read from the address (/sell...), so it can be
 * linked to, survives a refresh and needs no stored state. Whether the visitor may actually sell is
 * decided by the server, and the /sell pages redirect to sign-in or seller set-up when needed.
 */
export default function ModeSwitch({ className = '' }) {
  const { pathname } = useLocation();
  const selling = pathname === '/sell' || pathname.startsWith('/sell/');
  const base = 'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors';
  const on = 'bg-orange text-orange-fg';
  const off = 'text-hero-fg/85 hover:bg-hero-fg/10';
  return (
    <div role="group" aria-label="Account mode" className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-hero-fg/20 bg-hero-fg/5 p-1 ${className}`}>
      <Link to="/" aria-current={selling ? undefined : 'true'} className={`${base} ${selling ? off : on}`}>Buying</Link>
      <Link to="/sell" aria-current={selling ? 'true' : undefined} className={`${base} ${selling ? on : off}`}>Selling</Link>
    </div>
  );
}
