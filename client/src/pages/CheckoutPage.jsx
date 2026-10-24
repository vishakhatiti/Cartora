import { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import DemoBanner from '../components/DemoBanner.jsx';
import OrderSummary from '../components/OrderSummary.jsx';
import AddressFields, { EMPTY_ADDRESS, cleanAddress, toFormValues, validateAddress } from '../components/AddressFields.jsx';
import { useToast } from '../context/ToastContext.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

/** Delivery details and the order summary. The server prices the cart again when the checkout starts. */
export default function CheckoutPage() {
  const { user, status } = useAuth();
  const cart = useCart();
  const navigate = useNavigate();
  const toast = useToast();
  const config = useRemote((signal) => cart.api.checkoutConfig(signal), []);
  const saved = useRemote((signal) => (user ? cart.api.listAddresses(signal) : Promise.resolve({ addresses: [] })), [user?.id]);
  const savedList = saved.data?.addresses ?? [];
  const [values, setValues] = useState(EMPTY_ADDRESS);
  const [choice, setChoice] = useState(null); // id of a saved address, or 'new'
  const [saveIt, setSaveIt] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  // Start from the default saved address, once, unless the shopper has already chosen.
  useEffect(() => {
    if (choice !== null || savedList.length === 0) return;
    const pick = savedList.find((a) => a.isDefault) ?? savedList[0];
    setChoice(pick.id);
    setValues(toFormValues(pick));
  }, [savedList, choice]);
  const choose = (id) => {
    setChoice(id);
    setErrors({});
    setValues(id === 'new' ? EMPTY_ADDRESS : toFormValues(savedList.find((a) => a.id === id)));
  };

  if (status === 'loading' || cart.status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Loading checkout" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/checkout' }} replace />;
  if (cart.status === 'error') return <ErrorNotice error={cart.error} onRetry={cart.refresh} />;
  if (cart.lines.length === 0) return <Navigate to="/cart" replace />;

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = validateAddress(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const trimmed = cleanAddress(values);
      const { redirect } = await cart.api.startCheckout(trimmed);
      if (saveIt && (choice === 'new' || choice === null)) {
        try { await cart.api.addAddress(trimmed, savedList.length === 0); } catch { toast.info('Your order can continue, but this address could not be saved to your account.'); }
      }
      if (redirect.type === 'external') window.location.assign(redirect.url);
      else navigate(redirect.path);
    } catch (err) {
      setFormError(err.message || 'Could not start checkout. Please try again.');
      if (err.code === 'CART_INVALID') cart.refresh();
    } finally {
      setBusy(false);
    }
  };

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
          {savedList.length > 0 && (
            <fieldset className="mt-4 space-y-2">
              <legend className="text-sm font-semibold">Deliver to</legend>
              {savedList.map((a) => (
                <label key={a.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line-strong p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-pale">
                  <input type="radio" name="saved-address" checked={choice === a.id} onChange={() => choose(a.id)} className="mt-1" />
                  <span><strong>{a.name}</strong>{a.isDefault ? ' (default)' : ''}<br />{a.line1}{a.line2 ? `, ${a.line2}` : ''}, {a.city}, {a.state} {a.postalCode}, {a.country}</span>
                </label>
              ))}
              <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line-strong p-3 text-sm has-[:checked]:border-primary has-[:checked]:bg-pale">
                <input type="radio" name="saved-address" checked={choice === 'new'} onChange={() => choose('new')} /> Use a different address
              </label>
            </fieldset>
          )}
          {(savedList.length === 0 || choice === 'new') && (
            <div className="mt-4">
              <AddressFields values={values} errors={errors} onChange={setValues} idPrefix="co" />
              <label className="mt-4 flex items-center gap-2 text-sm"><input type="checkbox" checked={saveIt} onChange={(e) => setSaveIt(e.target.checked)} /> Save this address to my account</label>
            </div>
          )}
          {savedList.length > 0 && choice !== 'new' && errors.name && <p role="alert" className="mt-2 text-sm text-bad">Choose an address or enter a new one.</p>}
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
