import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { formatPrice } from '../lib/format.js';
import OrderSummary from '../components/OrderSummary.jsx';
import PageBand from '../components/PageBand.jsx';
import ProductImage from '../components/ProductImage.jsx';
import QtyStepper from '../components/QtyStepper.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

export default function CartPage() {
  const { user } = useAuth();
  const cart = useCart();
  const toast = useToast();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState(null);

  const run = async (productId, action) => {
    setBusyId(productId);
    try { await action(); } catch (err) { toast.error(err.message || 'Could not update your cart. Please try again.'); } finally { setBusyId(null); }
  };

  const checkout = () => navigate(user ? '/checkout' : '/sign-in', { state: user ? undefined : { from: '/checkout' } });

  return (
    <div className="settle">
      <PageBand title="Your cart" note={cart.itemCount > 0 ? `${cart.itemCount} item${cart.itemCount === 1 ? '' : 's'}` : undefined} />
      {cart.status === 'error' && <div className="mt-6"><ErrorNotice error={cart.error} onRetry={cart.refresh} /></div>}
      {cart.status === 'loading' && <div className="skeleton mt-6 h-48 rounded-3xl" role="status" aria-label="Loading your cart" />}

      {cart.status === 'ready' && cart.lines.length === 0 && (
        <section className="mx-auto mt-8 max-w-lg rounded-3xl bg-peach p-8 text-center">
          <h2 className="text-3xl">Your cart is empty</h2>
          <p className="mt-2 text-sm text-muted">Find something you like and add it here.</p>
          <Link to="/products" className="mt-5 inline-block rounded-full bg-orange px-6 py-2.5 font-semibold text-orange-fg">Continue shopping</Link>
        </section>
      )}

      {cart.status === 'ready' && cart.lines.length > 0 && (
        <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
          <div>
            {cart.issues.length > 0 && (
              <div role="alert" className="mb-4 rounded-2xl bg-butter px-4 py-3 text-sm font-medium">
                <p>Some items could not be included and were left out of your total.</p>
                <ul className="mt-1 list-disc pl-5">{cart.issues.map((i) => <li key={i.productId}>{i.message ?? 'This product is no longer available.'}</li>)}</ul>
              </div>
            )}
            <ul className="space-y-3" aria-label="Items in your cart">
              {cart.lines.map((l) => (
                <li key={l.productId} className="flex flex-wrap items-center gap-4 rounded-3xl border border-line-strong bg-surface p-4">
                  <Link to={`/product/${l.productId}`} className="shrink-0">
                    <ProductImage product={{ id: l.productId, title: l.title, brand: l.brand, category: { slug: l.category ?? 'x' }, images: l.image ? [{ thumb: l.image, large: l.image }] : [] }} size="large" alt="" className="h-24 w-24 rounded-2xl border border-line p-1" />
                  </Link>
                  <div className="min-w-0 flex-1 basis-48">
                    <Link to={`/product/${l.productId}`} className="line-clamp-2 font-semibold hover:underline">{l.title}</Link>
                    {l.brand && <p className="text-xs text-muted">{l.brand}</p>}
                    <p className="mt-1 text-sm text-muted">{formatPrice(l.unitPriceCents)} each</p>
                  </div>
                  <QtyStepper value={l.qty} disabled={busyId === l.productId} onChange={(n) => run(l.productId, () => cart.setQuantity(l.productId, n))} label={`Quantity for ${l.title}`} />
                  <p className="w-20 text-right font-bold">{formatPrice(l.unitPriceCents * l.qty)}</p>
                  <button type="button" disabled={busyId === l.productId} onClick={() => run(l.productId, () => cart.remove(l.productId))} aria-label={`Remove ${l.title}`} className="rounded-full px-3 py-1.5 text-sm font-semibold text-bad hover:bg-pale disabled:opacity-40">Remove</button>
                </li>
              ))}
            </ul>
            <Link to="/products" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">← Continue shopping</Link>
          </div>
          <OrderSummary lines={cart.lines} totals={cart.totals}>
            <button type="button" onClick={checkout} className="mt-5 w-full rounded-full bg-primary px-5 py-3 font-semibold text-primary-fg">
              {user ? 'Proceed to checkout' : 'Sign in to check out'}
            </button>
            {!user && <p className="mt-2 text-xs text-muted">You can keep shopping as a guest. Your cart is saved in this browser and added to your account when you sign in.</p>}
          </OrderSummary>
        </div>
      )}
    </div>
  );
}
