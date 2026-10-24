import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PageBand from '../components/PageBand.jsx';

/** Set-up for a seller account. The same login keeps working for shopping. */
export default function SellerStartPage() {
  const { user, status, api, setUser } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading') return <div className="skeleton h-48 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/sell/start' }} replace />;
  if (user.isSeller) return <Navigate to="/sell" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const name = storeName.trim();
    if (name.length < 2) { setError('Store name needs at least 2 characters.'); return; }
    setBusy(true);
    setError('');
    try {
      const { user: updated } = await api.becomeSeller(name);
      setUser(updated); // the server confirmed it, so only now does the page change
      toast.success('Your seller account is ready.');
      navigate('/sell', { replace: true });
    } catch (err) {
      setError(err.message || 'Could not set up your seller account. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settle">
      <PageBand title="Start selling on Cartora" note="Use the account you already have. You can switch between Buying and Selling at any time." />
      <form onSubmit={submit} noValidate className="mx-auto mt-8 max-w-lg rounded-3xl bg-peach p-6 sm:p-8">
        <label htmlFor="store-name" className="block text-sm font-semibold">Store name</label>
        <input
          id="store-name"
          value={storeName}
          onChange={(e) => setStoreName(e.target.value)}
          maxLength={60}
          autoComplete="organization"
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error ? 'store-error' : 'store-help'}
          className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5"
        />
        <p id="store-help" className="mt-1 text-xs text-muted">2 to 60 characters. Buyers will see this name on your listings.</p>
        {error && <p id="store-error" role="alert" className="mt-2 text-sm font-medium text-bad">{error}</p>}
        <button type="submit" disabled={busy} className="mt-6 w-full rounded-full bg-orange px-5 py-3 font-semibold text-orange-fg disabled:opacity-60">
          {busy ? 'Setting up…' : 'Activate seller account'}
        </button>
        <p className="mt-3 text-xs text-muted">Signed in as {user.email}. Payouts to sellers are not available yet.</p>
      </form>
    </div>
  );
}
