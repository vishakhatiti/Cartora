import { Link } from 'react-router-dom';

/** Centered card used by every sign-in screen. */
export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="settle mx-auto w-full max-w-md">
      <div className="rounded-3xl border border-line bg-surface p-6 shadow-sm sm:p-8">
        <h1 className="text-3xl font-extrabold">{title}</h1>
        {subtitle && <p className="mt-2 text-muted">{subtitle}</p>}
        <div className="mt-6 space-y-4">{children}</div>
      </div>
      {footer && <div className="mt-5 text-center text-sm text-muted">{footer}</div>}
    </div>
  );
}

export function GuestLink() {
  return (
    <Link to="/" className="font-medium text-primary underline-offset-2 hover:underline">
      Continue as guest
    </Link>
  );
}

export function OrDivider() {
  return (
    <div className="flex items-center gap-3 text-xs text-muted" role="separator">
      <span className="h-px flex-1 bg-line" />
      or
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}
