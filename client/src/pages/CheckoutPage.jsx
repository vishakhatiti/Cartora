import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import DemoBanner from '../components/DemoBanner.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

const EMPTY = { name: '', line1: '', line2: '', city: '', state: '', postalCode: '', country: 'US' };
const FIELDS = [
  ['name', 'Full name', 'name', 'sm:col-span-2'],
  ['line1', 'Address line 1', 'address-line1', 'sm:col-span-2'],
  ['line2', 'Address line 2 (optional)', 'address-line2', 'sm:col-span-2'],
  ['city', 'City', 'address-level2', ''],
  ['state', 'State or region', 'address-level1', ''],
  ['postalCode', 'Postal code', 'postal-code', ''],
  ['country', 'Country (2 letters)', 'country', ''],
];

function validate(values) {
  const errors = {};
  for (const [key, label] of FIELDS) {
    if (key !== 'line2' && !values[key].trim()) errors[key] = `${label.replace(' (optional)', '')} is required.`;
  }
  if (values.postalCode.trim() && !/^[A-Za-z0-9][A-Za-z0-9 -]{1,10}[A-Za-z0-9]$/.test(values.postalCode.trim())) errors.postalCode = 'Enter a valid postal code.';
  if (values.country.trim() && !/^[A-Za-z]{2}$/.test(values.country.trim())) errors.country = 'Use a two-letter country code, for example US.';
  return errors;
}

/** Delivery details and the order summary. The server prices the cart again when the checkout starts. */
export default function CheckoutPage() {
  const { user, status } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const config = useRemote((signal) => cart.api.checkoutConfig(signal), []);
  const [values, setValues] = useState(EMPTY);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  if (status === 'loading' || cart.status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Loading checkout" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/checkout' }} replace />;
  if (cart.status === 'error') return <ErrorNotice error={cart.error} onRetry={cart.refresh} />;
  if (cart.lines.length === 0) return <Navigate to="/cart" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const trimmed = Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v !== ''));
      const { redirect } = await cart.api.startCheckout(trimmed);
      if (redirect.type === 'external') window.location.assign(redirect.url);
      else navigate(redirect.path);
    } catch (err) {
      setFormError(err.message || 'Could not start checkout. Please try again.');
      if (err.code === 'CART_INVALID') cart.refresh();
    } finally {
      setBusy(false);
    }
  };

  const input = 'mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5';
  return (
    <div className="settle">
      <PageBand title="Checkout" breadcrumb={<><Link className="hover:underline" to="/cart">Cart</Link> <span aria-hidden="true">›</span> <span className="font-semibold text-orange">Delivery</span></>} />
      <div className="mt-6">
        {config.status === 'error' && <ErrorNotice error={config.error} onRetry={config.retry} />}
        {config.data?.demo && <DemoBanner label={config.data.label ?? undefined} />}
      </div>
      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_22rem]">
        <form onSubmit={submit} noValidate className="rounded-3xl border border-line-strong bg-surface p-6">
          <h2 className="text-2xl">Delivery address</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {FIELDS.map(([key, label, autoComplete, span]) => (
              <div key={key} className={span}>
                <label htmlFor={`co-${key}`} className="text-sm font-semibold">{label}</label>
                <input id={`co-${key}`} value={values[key]} autoComplete={autoComplete} maxLength={120}
                  onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                  aria-invalid={errors[key] ? 'true' : undefined} aria-describedby={errors[key] ? `co-${key}-err` : undefined} className={input} />
                {errors[key] && <p id={`co-${key}-err`} className="mt-1 text-xs font-medium text-bad">{errors[key]}</p>}
              </div>
            ))}
          </div>
          <h2 className="mt-8 text-2xl">Payment</h2>
          <p className="mt-1 text-sm text-muted">{config.data?.demo ? 'You will confirm a simulated payment on the next screen. No card details are asked for.' : 'You will pay on the next screen.'}</p>
          {formError && <p role="alert" className="mt-4 rounded-xl bg-butter px-4 py-3 text-sm font-medium">{formError}</p>}
          <button type="submit" disabled={busy || config.status !== 'ready'} className="mt-6 w-full rounded-full bg-orange px-5 py-3 font-semibold text-orange-fg disabled:opacity-60">
            {busy ? 'Starting checkout…' : config.data?.demo ? 'Continue to demo payment' : 'Continue to payment'}
          </button>
        </form>
        <OrderSummary lines={cart.lines} totals={cart.totals} />
      </div>
    </div>
  );
}
