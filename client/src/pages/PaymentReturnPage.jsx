import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PageBand from '../components/PageBand.jsx';

/** Exported so tests can shorten the waits. */
export const timing = { pollMs: 2000, giveUpMs: 60000 };

/**
 * Where Stripe sends the buyer after paying. Arriving here proves nothing: the order only exists once the server has
 * received Stripe's verified webhook. So this page just asks the server for the session's status until it settles.
 */
export default function PaymentReturnPage() {
  const { id } = useParams();
  const { user, status } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const [state, setState] = useState({ phase: 'checking', reason: '' });
  const refresh = useRef(cart.refresh);
  refresh.current = cart.refresh;

  useEffect(() => {
    if (!user) return undefined;
    let stopped = false;
    let timer;
    const started = Date.now();
    const check = async () => {
      try {
        const { session } = await cart.api.getSession(id);
        if (stopped) return;
        if (session.status === 'succeeded' && session.orderId) {
          await refresh.current(); // the server emptied the cart
          if (!stopped) navigate(`/orders/${session.orderId}`, { replace: true, state: { justPaid: true } });
          return;
        }
        if (session.status === 'failed') { setState({ phase: 'failed', reason: session.failureReason || 'The payment did not go through.' }); return; }
      } catch (err) {
        if (stopped) return;
        if (err.status === 404) { setState({ phase: 'missing', reason: '' }); return; }
        // A network blip: keep trying until the time is up.
      }
      if (Date.now() - started >= timing.giveUpMs) { setState({ phase: 'slow', reason: '' }); return; }
      timer = setTimeout(check, timing.pollMs);
    };
    check();
    return () => { stopped = true; clearTimeout(timer); };
  }, [id, user, cart.api, navigate]);

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: `/checkout/return/${id}` }} replace />;

  const { phase, reason } = state;
  return (
    <div className="settle">
      <PageBand title="Confirming your payment" />
      <section className="mx-auto mt-8 max-w-lg rounded-3xl border border-line-strong bg-surface p-8 text-center" aria-live="polite">
        {phase === 'checking' && (
          <>
            <div className="skeleton mx-auto h-3 w-40 rounded-full" role="status" aria-label="Confirming payment" />
            <h2 className="mt-5 text-2xl">Confirming your payment…</h2>
            <p className="mt-2 text-sm text-muted">This usually takes a few seconds. Please don’t close this page.</p>
          </>
        )}
        {phase === 'failed' && (
          <div role="alert">
            <h2 className="text-2xl text-bad">Payment not completed</h2>
            <p className="mt-2 text-sm">{reason}</p>
            <p className="mt-1 text-sm text-muted">Your cart is unchanged, so you can try again.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Link to="/checkout" className="rounded-full bg-orange px-5 py-2 text-sm font-semibold text-orange-fg">Try again</Link>
              <Link to="/cart" className="rounded-full border border-line-strong px-5 py-2 text-sm font-semibold hover:bg-pale">Back to cart</Link>
            </div>
          </div>
        )}
        {phase === 'slow' && (
          <>
            <h2 className="text-2xl">Still confirming</h2>
            <p className="mt-2 text-sm text-muted">We haven’t heard back from the payment provider yet. If you were charged, your order will appear in your orders shortly. You will not be charged twice.</p>
            <Link to="/orders" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg">View my orders</Link>
          </>
        )}
        {phase === 'missing' && (
          <>
            <h2 className="text-2xl">Checkout not found</h2>
            <Link to="/cart" className="mt-4 inline-block rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg">Back to cart</Link>
          </>
        )}
      </section>
    </div>
  );
}
