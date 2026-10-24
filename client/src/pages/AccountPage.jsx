import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import PageBand from '../components/PageBand.jsx';

const TILES = [
  { to: '/orders', title: 'Your orders', text: 'Track, review and re-open past orders.' },
  { to: '/wishlist', title: 'Wishlist', text: 'Products you saved for later.' },
  { to: '/account/addresses', title: 'Addresses', text: 'Delivery addresses for faster checkout.' },
  { to: '/help', title: 'Customer service', text: 'Answers, returns help and contact.' },
];

/** The account hub: who you are and where everything lives. */
export default function AccountPage() {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="skeleton mx-auto h-40 max-w-md rounded-3xl" role="status" aria-label="Loading your account" />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return (
    <div className="settle">
      <PageBand title="Your account" note={`Signed in as ${user.email}`} />
      <section aria-labelledby="profile-h" className="mt-6 rounded-3xl border border-line-strong bg-surface p-6">
        <h2 id="profile-h" className="text-2xl">Profile</h2>
        <dl className="mt-3 grid gap-4 text-sm sm:grid-cols-2">
          <div><dt className="text-muted">Name</dt><dd className="text-base font-medium">{user.name}</dd></div>
          <div><dt className="text-muted">Email</dt><dd className="text-base font-medium">{user.email}</dd></div>
          <div><dt className="text-muted">Account type</dt><dd className="text-base font-medium">{user.isSeller ? `Buyer and seller (${user.storeName})` : 'Buyer'}</dd></div>
        </dl>
      </section>
      <ul className="mt-6 grid gap-4 sm:grid-cols-2" aria-label="Account pages">
        {TILES.map((t) => (
          <li key={t.to}>
            <Link to={t.to} className="block h-full rounded-3xl bg-peach p-6 ring-2 ring-transparent transition hover:-translate-y-0.5 hover:ring-orange">
              <span className="text-xl font-semibold">{t.title}</span>
              <span className="mt-1 block text-sm text-muted">{t.text}</span>
            </Link>
          </li>
        ))}
        <li>
          <Link to={user.isSeller ? '/sell' : '/sell/start'} className="block h-full rounded-3xl bg-hero p-6 text-hero-fg ring-2 ring-transparent transition hover:-translate-y-0.5 hover:ring-orange">
            <span className="text-xl font-semibold">{user.isSeller ? 'Seller workspace' : 'Start selling'}</span>
            <span className="mt-1 block text-sm text-hero-fg/80">{user.isSeller ? 'Switch to your store.' : 'Turn this account into a seller account.'}</span>
          </Link>
        </li>
      </ul>
    </div>
  );
}
