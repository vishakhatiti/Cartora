import { Link } from 'react-router-dom';

export default function NotFoundPage() {
  return (
    <section className="settle mx-auto max-w-md py-10 text-center">
      <h1 className="text-4xl font-extrabold">Page not found</h1>
      <p className="mt-3 text-muted">The address may be mistyped, or the page has moved.</p>
      <Link to="/" className="mt-6 inline-block rounded-xl bg-primary px-5 py-2.5 font-semibold text-primary-fg">Go to the home page</Link>
    </section>
  );
}
