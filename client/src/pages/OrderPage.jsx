import { Link, useLocation, useParams } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import DemoBanner from '../components/DemoBanner.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';
import { Navigate } from 'react-router-dom';

/** Order confirmation and order details. Only the buyer can open it; anyone else gets "not found". */
export default function OrderPage() {
  const { id } = useParams();
  const { state } = useLocation();
  const { user, status } = useAuth();
  const { api } = useCart();
  const order = useRemote((signal) => api.getOrder(id, signal), [id]);

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: `/orders/${id}` }} replace />;
  if (order.status === 'error') {
    if (order.error?.status === 404) return <section className="mx-auto max-w-md py-10 text-center"><h1 className="text-3xl">Order not found</h1><p className="mt-2 text-muted">Check the link, or sign in with the account that placed the order.</p><Link to="/products" className="mt-6 inline-block rounded-full bg-primary px-5 py-2.5 font-semibold text-primary-fg">Browse products</Link></section>;
    return <ErrorNotice error={order.error} onRetry={order.retry} />;
  }
  if (!order.data) return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Loading order" />;

  const o = order.data.order;
  const a = o.shippingAddress;
  return (
    <div className="settle">
      <PageBand title={state?.justPaid ? 'Order confirmed' : 'Your order'} note={`Order ${o.orderNumber}`} />
      {o.payment.demo && <div className="mt-6"><DemoBanner /></div>}
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section aria-labelledby="od-h" className="space-y-5 rounded-3xl border border-line-strong bg-surface p-6">
          <h2 id="od-h" className="text-2xl">{state?.justPaid ? 'Thank you. Your demo order is placed.' : 'Order details'}</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div><dt className="font-semibold text-muted">Order number</dt><dd className="mt-0.5 font-mono font-bold">{o.orderNumber}</dd></div>
            <div><dt className="font-semibold text-muted">Status</dt><dd className="mt-0.5 font-semibold capitalize">{o.status}</dd></div>
            <div><dt className="font-semibold text-muted">Placed</dt><dd className="mt-0.5">{formatDate(o.createdAt)}</dd></div>
            <div>
              <dt className="font-semibold text-muted">Payment</dt>
              <dd className="mt-0.5">{o.payment.demo ? 'Demo payment — No Real Money Charged' : 'Paid'}</dd>
            </div>
            {a && (
              <div className="sm:col-span-2">
                <dt className="font-semibold text-muted">Delivering to</dt>
                <dd className="mt-0.5">{a.name}<br />{a.line1}{a.line2 ? <>, {a.line2}</> : null}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</dd>
              </div>
            )}
          </dl>
          <p className="text-sm text-muted">Tracking and delivery dates are not available yet.</p>
          <Link to="/products" className="inline-block rounded-full bg-primary px-6 py-2.5 text-sm font-semibold text-primary-fg">Continue shopping</Link>
        </section>
        <OrderSummary title="Items" lines={o.items.map((i) => ({ ...i, category: null }))} totals={o} />
      </div>
    </div>
  );
}
