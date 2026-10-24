import { Link, Navigate } from 'react-router-dom';
import { formatDate, formatPrice } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PageBand from '../components/PageBand.jsx';
import ProductImage from '../components/ProductImage.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

const STATUS_LABEL = { pending: 'Pending', paid: 'Paid', packed: 'Packed', shipped: 'Shipped', delivered: 'Delivered', cancelled: 'Cancelled', refunded: 'Refunded' };

/** The buyer's order history, newest first. Everything shown comes from the server. */
export default function OrdersPage() {
  const { user, status } = useAuth();
  const { api } = useCart();
  const orders = useRemote((signal) => api.listOrders(signal), [user?.id]);

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/orders' }} replace />;

  const list = orders.data?.orders ?? [];
  return (
    <div className="settle">
      <PageBand title="Your orders" note={orders.data ? `${list.length} order${list.length === 1 ? '' : 's'}` : undefined} />
      <div className="mt-6">
        {orders.status === 'error' && <ErrorNotice error={orders.error} onRetry={orders.retry} />}
        {orders.status === 'loading' && !orders.data && <div className="skeleton h-40 rounded-3xl" role="status" aria-label="Loading your orders" />}
        {orders.data && list.length === 0 && (
          <section className="mx-auto max-w-lg rounded-3xl bg-peach p-8 text-center">
            <h2 className="text-3xl">No orders yet</h2>
            <p className="mt-2 text-sm text-muted">When you place an order it will show up here.</p>
            <Link to="/products" className="mt-5 inline-block rounded-full bg-orange px-6 py-2.5 font-semibold text-orange-fg">Start shopping</Link>
          </section>
        )}
        {list.length > 0 && (
          <ul className="space-y-4" aria-label="Orders">
            {list.map((o) => (
              <li key={o.id} className="rounded-3xl border border-line-strong bg-surface p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <dl className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
                    <div><dt className="text-muted">Placed</dt><dd className="font-semibold">{formatDate(o.createdAt)}</dd></div>
                    <div><dt className="text-muted">Total</dt><dd className="font-semibold">{formatPrice(o.totalCents)}</dd></div>
                    <div><dt className="text-muted">Order</dt><dd className="font-mono font-semibold">{o.orderNumber}</dd></div>
                    <div><dt className="text-muted">Status</dt><dd className="font-semibold">{STATUS_LABEL[o.status] ?? o.status}</dd></div>
                  </dl>
                  <Link to={`/orders/${o.id}`} className="rounded-full border border-line-strong px-5 py-2 text-sm font-semibold hover:bg-pale">View order</Link>
                </div>
                <ul className="mt-4 flex flex-wrap gap-3" aria-label={`Items in order ${o.orderNumber}`}>
                  {o.items.map((i) => (
                    <li key={i.productId} className="flex items-center gap-2 text-sm">
                      <ProductImage product={{ id: i.productId, title: i.title, brand: i.brand, category: { slug: 'x' }, images: i.image ? [{ thumb: i.image, large: i.image }] : [] }} size="thumb" alt="" className="h-12 w-12 rounded-xl border border-line p-0.5" />
                      <span className="line-clamp-1 max-w-48">{i.title}{i.qty > 1 ? ` × ${i.qty}` : ''}</span>
                    </li>
                  ))}
                </ul>
                {o.payment.demo && <p className="mt-3 text-xs text-muted">Demo payment — No Real Money Charged</p>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
