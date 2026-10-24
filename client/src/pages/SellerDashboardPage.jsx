import { useEffect } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { sellerApi } from '../lib/api.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

/** Seller workspace. The seller role is checked by the server (GET /api/seller/me), not only by this page. */
function Dashboard({ user }) {
  const { setUser } = useAuth();
  const store = useRemote((signal) => sellerApi.me(signal), []);
  const notSeller = store.status === 'error' && store.error?.status === 403;

  // The server is the authority. If it says this account is not a seller, correct what the page believes,
  // otherwise /sell and /sell/start would keep sending the visitor to each other.
  useEffect(() => {
    if (notSeller) setUser({ ...user, isSeller: false, storeName: null });
  }, [notSeller, setUser, user]);

  if (notSeller) return <Navigate to="/sell/start" replace />;
  if (store.status === 'error') return <ErrorNotice error={store.error} onRetry={store.retry} />;
  if (!store.data) return <div className="skeleton h-56 rounded-3xl" role="status" aria-label="Loading your store" />;

  return (
    <div className="settle">
      <PageBand title="Seller dashboard" note={`Store: ${store.data.store.name}`} />
      <section aria-labelledby="start-h" className="mx-auto mt-8 max-w-2xl rounded-3xl bg-peach p-8 text-center">
        <span aria-hidden="true" className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-primary text-3xl text-primary-fg">⌂</span>
        <h2 id="start-h" className="mt-4 text-3xl">Start selling on Cartora</h2>
        <p className="mt-2 text-sm text-muted">
          Your seller account is active. Creating listings, managing stock and seeing seller orders are the next features,
          so there is nothing to list or ship yet. No sales figures are shown because there are no sales records.
        </p>
        <Link to="/products" className="mt-6 inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-fg">Back to shopping</Link>
        <p className="mt-4 text-xs text-muted">Signed in as {user.email}. Use the Buying switch in the header to shop with the same account.</p>
      </section>
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
