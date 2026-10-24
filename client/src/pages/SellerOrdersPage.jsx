import { useState } from 'react';
import { sellerApi } from '../lib/api.js';
import { formatDate, formatPrice } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useToast } from '../context/ToastContext.jsx';
import PageBand from '../components/PageBand.jsx';
import SellerGate from '../components/SellerGate.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

function Orders() {
  const toast = useToast();
  const list = useRemote((signal) => sellerApi.orders(signal), []);
  const [busyId, setBusyId] = useState(null);
  const [local, setLocal] = useState({});

  const ship = async (order) => {
    setBusyId(order.id);
    try {
      const { order: updated } = await sellerApi.ship(order.id);
      setLocal((prev) => ({ ...prev, [order.id]: updated }));
      toast.success(`Order ${order.orderNumber} marked as shipped.`);
    } catch (err) {
      toast.error(err.message || 'Could not update this order. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  const orders = (list.data?.orders ?? []).map((o) => local[o.id] ?? o);
  return (
    <div className="settle">
      <PageBand title="Orders" note={list.data ? `${orders.filter((o) => o.fulfilment === 'pending').length} to ship` : undefined} />
      <div className="mt-6">
        {list.status === 'error' && <ErrorNotice error={list.error} onRetry={list.retry} />}
        {list.status === 'loading' && !list.data && <div className="skeleton h-40 rounded-3xl" role="status" aria-label="Loading orders" />}
        {list.data && orders.length === 0 && (
          <section className="mx-auto max-w-lg rounded-3xl bg-peach p-8 text-center">
            <h2 className="text-3xl">No orders yet</h2>
            <p className="mt-2 text-sm text-muted">When a shopper buys one of your products, the order appears here with the address to ship to.</p>
          </section>
        )}
        {orders.length > 0 && (
          <ul className="space-y-4" aria-label="Seller orders">
            {orders.map((o) => {
              const a = o.shippingAddress;
              return (
                <li key={o.id} className="rounded-3xl border border-line-strong bg-surface p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono font-bold">{o.orderNumber}</p>
                      <p className="text-sm text-muted">{formatDate(o.createdAt)} · {formatPrice(o.subtotalCents)}{o.payment.demo ? ' · Demo payment — No Real Money Charged' : ''}</p>
                    </div>
                    {o.fulfilment === 'shipped'
                      ? <span className="rounded-full bg-pale px-4 py-1.5 text-sm font-bold">Shipped</span>
                      : <button type="button" disabled={busyId === o.id} onClick={() => ship(o)} aria-label={`Mark order ${o.orderNumber} as shipped`} className="rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-fg disabled:opacity-60">Mark as shipped</button>}
                  </div>
                  <ul className="mt-3 divide-y divide-line text-sm" aria-label={`Items in order ${o.orderNumber}`}>
                    {o.items.map((i) => <li key={i.productId} className="flex justify-between gap-3 py-1.5"><span>{i.title} × {i.qty}</span><span>{formatPrice(i.unitPriceCents * i.qty)}</span></li>)}
                  </ul>
                  {a && <p className="mt-3 text-sm"><strong>Ship to:</strong> {a.name}, {a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country}</p>}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function SellerOrdersPage() {
  return <SellerGate><Orders /></SellerGate>;
}
