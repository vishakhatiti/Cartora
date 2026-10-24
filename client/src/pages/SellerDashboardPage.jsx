import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { sellerApi } from '../lib/api.js';
import { formatPrice } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

function Tile({ label, value, hint, to }) {
  const body = (
    <>
      <span className="text-sm font-semibold text-muted">{label}</span>
      <span className="mt-1 block text-4xl font-display">{value}</span>
      {hint && <span className="mt-1 block text-xs text-muted">{hint}</span>}
    </>
  );
  const cls = 'block rounded-3xl bg-peach p-5';
  return <li>{to ? <Link to={to} className={`${cls} ring-2 ring-transparent transition hover:ring-orange`}>{body}</Link> : <div className={cls}>{body}</div>}</li>;
}

/** Seller workspace. Every number comes from the server (GET /api/seller/summary); the role is checked there too. */
function Dashboard({ user }) {
  const { setUser } = useAuth();
  const summary = useRemote((signal) => sellerApi.summary(signal), []);
  const notSeller = summary.status === 'error' && summary.error?.status === 403;

  // The server is the authority. If it says this account is not a seller, correct what the page believes,
  // otherwise /sell and /sell/start would keep sending the visitor to each other.
  useEffect(() => {
    if (notSeller) setUser({ ...user, isSeller: false, storeName: null });
  }, [notSeller, setUser, user]);

  if (notSeller) return <Navigate to="/sell/start" replace />;
  if (summary.status === 'error') return <ErrorNotice error={summary.error} onRetry={summary.retry} />;
  if (!summary.data) return <div className="skeleton h-56 rounded-3xl" role="status" aria-label="Loading your store" />;

  const s = summary.data.summary;
  return (
    <div className="settle">
      <PageBand title="Seller dashboard" note={`Store: ${s.store.name}`} />
      {s.products.total === 0 ? (
        <section aria-labelledby="start-h" className="mx-auto mt-8 max-w-2xl rounded-3xl bg-peach p-8 text-center">
          <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-3xl text-primary-fg">⌂</span>
          <h2 id="start-h" className="mt-4 text-3xl">Add your first product</h2>
          <p className="mt-2 text-sm text-muted">Your seller account is active. List a product and it appears in search for every shopper straight away. There are no sales figures yet because there are no sales.</p>
          <Link to="/sell/products/new" className="mt-6 inline-block rounded-full bg-orange px-6 py-2.5 text-sm font-semibold text-orange-fg">Add a product</Link>
        </section>
      ) : (
        <>
          <ul className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Store figures">
            <Tile label="Active products" value={s.products.active} hint={`${s.products.total} in total`} to="/sell/products" />
            <Tile label="Orders to ship" value={s.orders.toShip} hint={`${s.orders.shipped} shipped`} to="/sell/orders" />
            <Tile label="Out of stock" value={s.products.outOfStock} hint={s.products.outOfStock > 0 ? 'Restock to sell again' : 'Nothing sold out'} to="/sell/products" />
            <Tile label="Sales" value={formatPrice(s.salesCents)} hint={s.demoOrders > 0 ? `Includes ${s.demoOrders} demo order${s.demoOrders === 1 ? '' : 's'}: Demo Mode — No Real Money Charged` : 'Value of your items in paid orders'} />
          </ul>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link to="/sell/products/new" className="rounded-full bg-orange px-6 py-2.5 text-sm font-semibold text-orange-fg">Add a product</Link>
            <Link to="/sell/orders" className="rounded-full border border-line-strong px-6 py-2.5 text-sm font-semibold hover:bg-pale">View orders</Link>
          </div>
        </>
      )}
      <p className="mt-8 text-xs text-muted">Signed in as {user.email}. Use the Buying switch in the header to shop with the same account.</p>
    </div>
  );
}

export default function SellerDashboardPage() {
  const { user, status } = useAuth();
  if (status === 'loading') return <div className="skeleton h-48 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/sell' }} replace />;
  if (!user.isSeller) return <Navigate to="/sell/start" replace />;
  return <Dashboard user={user} />;
}
