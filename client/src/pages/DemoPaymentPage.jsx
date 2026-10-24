import { useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { formatPrice } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import DemoBanner from '../components/DemoBanner.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

/**
 * The payment step while payments are simulated. It shows what the server priced and offers two buttons.
 * There are no card fields on purpose. With Stripe this page is replaced by Stripe's hosted page.
 */
export default function DemoPaymentPage() {
  const { id } = useParams();
  const { user, status } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const session = useRemote((signal) => cart.api.getSession(id, signal), [id]);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState('');
  const [error, setError] = useState('');

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: `/checkout/pay/${id}` }} replace />;
  if (session.status === 'error') {
    if (session.error?.status === 404) return <section className="mx-auto max-w-md py-10 text-center"><h1 className="text-3xl">Checkout not found</h1><p className="mt-2 text-muted">It may have expired.</p><Link to="/cart" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-fg">Back to cart</Link></section>;
    return <ErrorNotice error={session.error} onRetry={session.retry} />;
  }
  if (!session.data) return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Loading payment" />;

  const s = session.data.session;
  if (s.status === 'succeeded' && s.orderId) return <Navigate to={`/orders/${s.orderId}`} replace />;
  const failed = s.status === 'failed' || Boolean(failure);

  const simulate = async (outcome) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const result = await cart.api.simulate(id, outcome);
      if (result.order) {
        await cart.refresh(); // the server emptied the cart; show that
        toast.success('Demo payment succeeded. Your order is confirmed.');
        navigate(`/orders/${result.order.id}`, { replace: true, state: { justPaid: true } });
      } else {
        setFailure(result.session.failureReason || 'The demo payment failed.');
        await cart.refresh(); // proves the cart is still there
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Nothing was charged. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="settle">
      <PageBand title="Payment" breadcrumb={<><Link className="hover:underline" to="/cart">Cart</Link> <span aria-hidden="true">›</span> Delivery <span aria-hidden="true">›</span> <span className="font-semibold text-orange">Payment</span></>} />
      <div className="mt-6"><DemoBanner label={s.payment.label ?? undefined} /></div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="pay-h" className="rounded-3xl border border-line-strong bg-surface p-6">
          <h2 id="pay-h" className="text-2xl">Simulate your payment</h2>
          <p className="mt-2 text-sm text-muted">
            Amount to pay: <strong className="text-fg">{formatPrice(s.totalCents)}</strong>. This is a demonstration, so choose how the payment should end.
            Nothing is charged either way.
          </p>

          {failed && (
            <div role="alert" className="mt-5 rounded-2xl border border-bad bg-surface p-4">
              <p className="font-bold text-bad">Payment failed</p>
              <p className="mt-1 text-sm">{failure || s.failureReason || 'The demo payment failed.'}</p>
              <p className="mt-1 text-sm text-muted">Your cart is unchanged, so you can try again.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/checkout" className="rounded-full bg-orange px-5 py-2 text-sm font-semibold text-orange-fg">Try again</Link>
                <Link to="/cart" className="rounded-full border border-line-strong px-5 py-2 text-sm font-semibold hover:bg-pale">Back to cart</Link>
              </div>
            </div>
          )}
          {error && <p role="alert" className="mt-5 rounded-xl bg-butter px-4 py-3 text-sm font-medium">{error}</p>}

          {!failed && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <button type="button" disabled={busy} onClick={() => simulate('success')} className="rounded-full bg-primary px-5 py-3 font-semibold text-primary-fg disabled:opacity-60">
                {busy ? 'Working…' : 'Simulate Successful Payment'}
              </button>
              <button type="button" disabled={busy} onClick={() => simulate('failure')} className="rounded-full border-2 border-bad px-5 py-3 font-semibold text-bad hover:bg-pale disabled:opacity-60">
                Simulate Failed Payment
              </button>
            </div>
          )}
          <p className="mt-4 text-xs text-muted">Demo Mode — No Real Money Charged. Your orders will say “Demo payment”.</p>
        </section>
        <OrderSummary lines={s.items.map((i) => ({ ...i, category: null }))} totals={s} />
      </div>
    </div>
  );
}
