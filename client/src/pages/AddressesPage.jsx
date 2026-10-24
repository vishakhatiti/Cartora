import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import AddressFields, { EMPTY_ADDRESS, cleanAddress, toFormValues, validateAddress } from '../components/AddressFields.jsx';
import PageBand from '../components/PageBand.jsx';
import { ErrorNotice } from '../components/ProductCard.jsx';

function AddressForm({ initial, onSave, onCancel, saving }) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState({});
  const submit = (e) => {
    e.preventDefault();
    const found = validateAddress(values);
    setErrors(found);
    if (Object.keys(found).length === 0) onSave(cleanAddress(values));
  };
  return (
    <form onSubmit={submit} noValidate className="rounded-3xl border border-line-strong bg-surface p-6">
      <AddressFields values={values} errors={errors} onChange={setValues} idPrefix="ab" />
      <div className="mt-5 flex gap-3">
        <button type="submit" disabled={saving} className="rounded-full bg-primary px-6 py-2.5 font-semibold text-primary-fg disabled:opacity-60">{saving ? 'Saving…' : 'Save address'}</button>
        <button type="button" onClick={onCancel} className="rounded-full border border-line-strong px-6 py-2.5 font-semibold hover:bg-pale">Cancel</button>
      </div>
    </form>
  );
}

export default function AddressesPage() {
  const { user, status } = useAuth();
  const { api } = useCart();
  const toast = useToast();
  const list = useRemote((signal) => api.listAddresses(signal), [user?.id]);
  const [mode, setMode] = useState(null); // null | 'new' | address id being edited
  const [busy, setBusy] = useState(false);
  const [override, setOverride] = useState(null); // latest list returned by the server after a change

  if (status === 'loading') return <div className="skeleton h-64 rounded-3xl" role="status" aria-label="Checking sign-in" />;
  if (!user) return <Navigate to="/sign-in" state={{ from: '/account/addresses' }} replace />;

  const addresses = override ?? list.data?.addresses ?? [];
  const run = async (action, done) => {
    setBusy(true);
    try { const result = await action(); setOverride(result.addresses); setMode(null); if (done) toast.success(done); } catch (err) { toast.error(err.message || 'Something went wrong. Please try again.'); } finally { setBusy(false); }
  };

  return (
    <div className="settle">
      <PageBand title="Your addresses" breadcrumb={<><Link className="hover:underline" to="/account">Account</Link> <span aria-hidden="true">›</span> <span className="font-semibold text-orange">Addresses</span></>} />
      <div className="mt-6 space-y-4">
        {list.status === 'error' && <ErrorNotice error={list.error} onRetry={list.retry} />}
        {list.status === 'loading' && !list.data && <div className="skeleton h-32 rounded-3xl" role="status" aria-label="Loading your addresses" />}
        {list.data && addresses.length === 0 && mode !== 'new' && (
          <section className="mx-auto max-w-lg rounded-3xl bg-peach p-8 text-center">
            <h2 className="text-3xl">No saved addresses</h2>
            <p className="mt-2 text-sm text-muted">Save one here and checkout will offer it.</p>
          </section>
        )}
        {addresses.length > 0 && (
          <ul className="grid gap-4 sm:grid-cols-2" aria-label="Saved addresses">
            {addresses.map((a) => (
              <li key={a.id} className="rounded-3xl border border-line-strong bg-surface p-5">
                {mode === a.id ? (
                  <AddressForm initial={toFormValues(a)} saving={busy} onCancel={() => setMode(null)} onSave={(data) => run(() => api.updateAddress(a.id, data), 'Address updated.')} />
                ) : (
                  <>
                    <p className="font-semibold">{a.name}{a.isDefault && <span className="ml-2 rounded-full bg-pale px-2 py-0.5 text-xs font-bold">Default</span>}</p>
                    <p className="mt-1 text-sm text-muted">{a.line1}{a.line2 ? `, ${a.line2}` : ''}<br />{a.city}, {a.state} {a.postalCode}, {a.country}</p>
                    <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold">
                      <button type="button" disabled={busy} onClick={() => setMode(a.id)} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-pale">Edit</button>
                      {!a.isDefault && <button type="button" disabled={busy} onClick={() => run(() => api.setDefaultAddress(a.id), 'Default address changed.')} className="rounded-full border border-line-strong px-4 py-1.5 hover:bg-pale">Make default</button>}
                      <button type="button" disabled={busy} onClick={() => run(() => api.deleteAddress(a.id), 'Address removed.')} aria-label={`Remove address ${a.line1}`} className="rounded-full px-4 py-1.5 text-bad hover:bg-pale">Remove</button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
        {mode === 'new' ? (
          <AddressForm initial={EMPTY_ADDRESS} saving={busy} onCancel={() => setMode(null)} onSave={(data) => run(() => api.addAddress(data, addresses.length === 0), 'Address saved.')} />
        ) : (
          list.data && <button type="button" onClick={() => setMode('new')} className="rounded-full bg-orange px-6 py-2.5 font-semibold text-orange-fg">Add an address</button>
        )}
      </div>
    </div>
  );
}
