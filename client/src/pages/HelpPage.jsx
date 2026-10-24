import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatDate } from '../lib/format.js';
import { useRemote } from '../hooks/useRemote.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useCart } from '../context/CartContext.jsx';
import PageBand from '../components/PageBand.jsx';

const TOPICS = [
  ['order', 'An order'], ['payment', 'Payment'], ['delivery', 'Delivery'], ['returns', 'Returns and refunds'],
  ['account', 'My account'], ['selling', 'Selling on Cartora'], ['other', 'Something else'],
];

// Every answer describes how Cartora works today. Nothing here promises a delivery time, refund window or reply time.
const FAQ = [
  ['What does shipping cost?', 'Shipping is free when your subtotal is $50.00 or more, and $5.99 below that. Tax is not charged.'],
  ['Is my payment real?', 'Not yet. Checkout runs in Demo Mode: you choose whether a payment succeeds or fails, nothing is charged, and no card details are asked for. Every checkout screen and order says "Demo Mode — No Real Money Charged".'],
  ['Where can I see my orders?', 'Open Your orders from the account menu. It lists every order with its number, total and status. Tracking numbers and delivery dates are not available yet.'],
  ['How do I return or cancel an order?', 'Self-service returns and cancellations are not available yet. Send us a request below with your order number and we will look into it.'],
  ['I cannot sign in.', 'On the sign-in page you can use your password or ask for an emailed code. If you forgot your password, choose "Forgot password" to reset it with an emailed code.'],
  ['How do I sell on Cartora?', 'Use the Buying / Selling switch in the header. The same account becomes a seller account once you pick a store name.'],
];

function ContactForm({ api, user, onSent }) {
  const [values, setValues] = useState({ name: user?.name ?? '', email: user?.email ?? '', topic: 'order', orderNumber: '', message: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  const set = (k) => (e) => setValues({ ...values, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    if (busy) return;
    const found = {};
    if (!values.name.trim()) found.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(values.email.trim())) found.email = 'Enter a valid email address.';
    if (values.orderNumber.trim() && !/^CRT-[A-Za-z0-9]{8}$/.test(values.orderNumber.trim())) found.orderNumber = 'Order numbers look like CRT-ABCD2345.';
    if (values.message.trim().length < 10) found.message = 'Please write at least 10 characters.';
    setErrors(found);
    setError('');
    if (Object.keys(found).length > 0) return;
    setBusy(true);
    try {
      const { ticket } = await api.createTicket({ ...values, name: values.name.trim(), email: values.email.trim(), orderNumber: values.orderNumber.trim(), message: values.message.trim() });
      setSent(ticket);
      setValues({ ...values, orderNumber: '', message: '' });
      onSent?.();
    } catch (err) {
      setError(err.message || 'Your request could not be sent. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = 'mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5';
  const err = (k) => errors[k] && <p id={`hp-${k}-err`} className="mt-1 text-xs font-medium text-bad">{errors[k]}</p>;
  return (
    <form onSubmit={submit} noValidate className="rounded-3xl border border-line-strong bg-surface p-6">
      <h2 className="text-2xl">Contact us</h2>
      {sent && (
        <p role="status" className="mt-4 rounded-xl bg-pale px-4 py-3 text-sm font-medium">
          Request received. Your reference is <strong className="font-mono">{sent.ticketNumber}</strong>. Keep it if you write to us again.
        </p>
      )}
      {error && <p role="alert" className="mt-4 rounded-xl bg-butter px-4 py-3 text-sm font-medium">{error}</p>}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div><label htmlFor="hp-name" className="text-sm font-semibold">Your name</label><input id="hp-name" value={values.name} onChange={set('name')} maxLength={80} autoComplete="name" aria-invalid={errors.name ? 'true' : undefined} className={field} />{err('name')}</div>
        <div><label htmlFor="hp-email" className="text-sm font-semibold">Email</label><input id="hp-email" type="email" value={values.email} onChange={set('email')} readOnly={Boolean(user)} autoComplete="email" aria-invalid={errors.email ? 'true' : undefined} className={`${field} ${user ? 'opacity-70' : ''}`} />{err('email')}</div>
        <div><label htmlFor="hp-topic" className="text-sm font-semibold">What is it about?</label>
          <select id="hp-topic" value={values.topic} onChange={set('topic')} className={field}>{TOPICS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></div>
        <div><label htmlFor="hp-order" className="text-sm font-semibold">Order number (optional)</label><input id="hp-order" value={values.orderNumber} onChange={set('orderNumber')} placeholder="CRT-ABCD2345" maxLength={12} aria-invalid={errors.orderNumber ? 'true' : undefined} className={field} />{err('orderNumber')}</div>
        <div className="sm:col-span-2"><label htmlFor="hp-message" className="text-sm font-semibold">How can we help?</label><textarea id="hp-message" rows={5} value={values.message} onChange={set('message')} maxLength={2000} aria-invalid={errors.message ? 'true' : undefined} className={field} />{err('message')}</div>
      </div>
      <button type="submit" disabled={busy} className="mt-5 rounded-full bg-primary px-7 py-3 font-semibold text-primary-fg disabled:opacity-60">{busy ? 'Sending…' : 'Send request'}</button>
    </form>
  );
}

export default function HelpPage() {
  const { user } = useAuth();
  const { api } = useCart();
  const mine = useRemote((signal) => (user ? api.listTickets(signal) : Promise.resolve({ tickets: [] })), [user?.id]);
  const tickets = mine.data?.tickets ?? [];
  return (
    <div className="settle">
      <PageBand title="Customer service" note="Answers to common questions, and a way to reach us." />
      <section aria-labelledby="faq-h" className="mt-8">
        <h2 id="faq-h" className="text-3xl">Common questions</h2>
        <div className="mt-4 divide-y divide-line overflow-hidden rounded-3xl border border-line-strong bg-surface">
          {FAQ.map(([q, a]) => (
            <details key={q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-semibold marker:hidden">{q}</summary>
              <p className="mt-2 text-sm text-muted">{a}</p>
            </details>
          ))}
        </div>
      </section>
      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ContactForm key={user?.id ?? "guest"} api={api} user={user} onSent={mine.retry} />
        <aside aria-labelledby="mine-h" className="rounded-3xl bg-peach p-5">
          <h2 id="mine-h" className="text-2xl">Your requests</h2>
          {!user && <p className="mt-2 text-sm text-muted"><Link to="/sign-in" state={{ from: '/help' }} className="font-semibold text-primary underline">Sign in</Link> to see the requests you have sent.</p>}
          {user && tickets.length === 0 && <p className="mt-2 text-sm text-muted">No requests yet.</p>}
          {tickets.length > 0 && (
            <ul className="mt-3 space-y-3">
              {tickets.map((t) => (
                <li key={t.id} className="rounded-2xl bg-surface p-3 text-sm">
                  <p className="font-mono font-semibold">{t.ticketNumber}</p>
                  <p className="text-xs text-muted">{formatDate(t.createdAt)} · {TOPICS.find(([v]) => v === t.topic)?.[1]} · {t.status}</p>
                  <p className="mt-1 line-clamp-2">{t.message}</p>
                </li>
              ))}
            </ul>
          )}
        </aside>
      </div>
    </div>
  );
}
