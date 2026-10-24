import StatusPanel from '../components/StatusPanel.jsx';

// Items listed here are not built yet; ROADMAP.md tracks real progress.
const UPCOMING = [
  { title: 'Browse 12,000 products', text: 'Search, filters and product pages with real photos. The catalog API is ready; the pages are next.' },
  { title: 'Cart and wishlist', text: 'Saved in your browser as a guest and in your account once you sign in.' },
  { title: 'Card payments', text: 'Checkout through Stripe, with a confirmation email.' },
  { title: 'Buy and sell', text: 'One account with a switch between buying and selling.' },
];

export default function HomePage() {
  return (
    <div className="settle">
      <section className="text-center">
        <p className="mx-auto inline-block rounded-full border border-line bg-surface px-3 py-1 text-sm font-semibold text-primary">
          Under construction
        </p>
        <h1 className="mx-auto mt-5 max-w-4xl text-4xl font-extrabold leading-tight sm:text-6xl">
          Shop smarter. Sell from the same account.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
          Cartora is a marketplace built to be calmer than the big ones: no sponsored clutter, no forced accounts,
          and one login for buying and selling.
        </p>
      </section>

      <div className="mt-12 grid gap-6 md:grid-cols-5">
        <div className="md:col-span-2">
          <StatusPanel />
        </div>
        <section aria-labelledby="planned-heading" className="md:col-span-3">
          <h2 id="planned-heading" className="text-lg font-bold">Coming next</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {UPCOMING.map((item) => (
              <li key={item.title} className="rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-primary">
                <h3 className="font-semibold">{item.title}</h3>
                <p className="mt-1 text-sm text-muted">{item.text}</p>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
