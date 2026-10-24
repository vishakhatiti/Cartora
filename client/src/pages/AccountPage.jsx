import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function AccountPage() {
  const { user, status } = useAuth();
  const location = useLocation();
  if (status === 'loading') return <div className="skeleton mx-auto h-40 max-w-md rounded-3xl" role="status" aria-label="Loading your account" />;
  if (!user) return <Navigate to="/sign-in" replace state={{ from: location.pathname }} />;
  return (
    <section className="settle mx-auto max-w-md rounded-3xl border border-line bg-surface p-6 sm:p-8">
      <h1 className="text-3xl font-extrabold">Your account</h1>
      <dl className="mt-5 space-y-3 text-sm">
        <div><dt className="text-muted">Name</dt><dd className="text-base font-medium">{user.name}</dd></div>
        <div><dt className="text-muted">Email</dt><dd className="text-base font-medium">{user.email}</dd></div>
      </dl>
    </section>
  );
}
