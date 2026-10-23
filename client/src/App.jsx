import StatusPanel from './components/StatusPanel.jsx';
import ThemeToggle from './components/ThemeToggle.jsx';

// Items marked "Planned" are not built yet; ROADMAP.md tracks real progress.
const UPCOMING = [
  { title: 'One account, two modes', text: 'Switch between Buyer and Seller without a second login.' },
  { title: 'Guest checkout', text: 'Buy with just an email address. No forced sign-up.' },
  { title: 'Passwordless sign-in', text: 'Get a one-time code by email, or continue with Google.' },
  { title: 'Cart and wishlist', text: 'Saved in your browser as a guest and in your account once you sign in.' },
];

export default function App() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-line bg-surface/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 text-lg font-bold tracking-tight">
            <img src="/favicon.svg" alt="" width="28" height="28" />
            Cartora
          </a>
          <ThemeToggle />
        </div>
      </header>

      <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-10 sm:px-6 sm:py-16">
        <section className="rise-in text-center">
          <p className="mx-auto inline-block rounded-full border border-line bg-surface px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            Under construction
          </p>
          <h1 className="mx-auto mt-5 max-w-2xl text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl">
            Shop smarter.
            <span className="block text-primary">Sell from the same account.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-base text-muted sm:text-lg">
            Cartora is a marketplace built to be calmer than the big ones: no sponsored clutter, no forced accounts,
            and one login for buying and selling.
          </p>
        </section>

        <div className="rise-in mt-10 grid gap-6 md:grid-cols-5" style={{ animationDelay: '0.12s' }}>
          <div className="md:col-span-2">
            <StatusPanel />
          </div>
          <section aria-labelledby="planned-heading" className="md:col-span-3">
            <h2 id="planned-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
              Planned
            </h2>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {UPCOMING.map((item) => (
                <li
                  key={item.title}
                  className="rounded-2xl border border-line bg-surface p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
                >
                  <h3 className="font-semibold">{item.title}</h3>
                  <p className="mt-1 text-sm text-muted">{item.text}</p>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>

      <footer className="border-t border-line">
        <div className="mx-auto max-w-5xl px-4 py-5 text-sm text-muted sm:px-6">
          Built in the open on{' '}
          <a className="font-medium text-primary underline-offset-2 hover:underline" href="https://github.com/vishakhatiti/Cartora">
            GitHub
          </a>
          .
        </div>
      </footer>
    </div>
  );
}
