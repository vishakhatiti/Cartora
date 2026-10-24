import { useEffect, useId, useState } from 'react';

export function Field({ label, error, hint, ...inputProps }) {
  const id = useId();
  const describedBy = [error && `${id}-error`, hint && `${id}-hint`].filter(Boolean).join(' ') || undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">{label}</label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`w-full rounded-xl border bg-surface px-3 py-2.5 text-base transition-colors placeholder:text-muted/70 hover:border-primary ${
          error ? 'border-bad' : 'border-line'
        }`}
        {...inputProps}
      />
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-muted">{hint}</p>}
      {error && <p id={`${id}-error`} className="mt-1 text-sm text-bad">{error}</p>}
    </div>
  );
}

export function CodeField({ error, ...props }) {
  return (
    <Field
      label="6-digit code"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      pattern="\d{6}"
      placeholder="000000"
      error={error}
      {...props}
      style={{ letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem', fontVariantNumeric: 'tabular-nums' }}
    />
  );
}

export function Button({ busy, children, variant = 'primary', ...props }) {
  const look = variant === 'primary'
    ? 'bg-primary text-primary-fg hover:-translate-y-0.5 hover:shadow-md'
    : 'border border-line bg-surface hover:border-primary';
  return (
    <button
      type="button"
      disabled={busy || props.disabled}
      className={`inline-flex w-full items-center justify-center rounded-xl px-4 py-2.5 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 ${look}`}
      {...props}
    >
      {busy ? 'Please wait…' : children}
    </button>
  );
}

export function FormError({ children }) {
  if (!children) return null;
  return <p role="alert" className="rounded-xl border border-bad px-3 py-2 text-sm text-bad">{children}</p>;
}

/** Seconds left before another code can be requested. restart() begins a new countdown. */
export function useCountdown(initial = 0) {
  const [left, setLeft] = useState(initial);
  useEffect(() => {
    if (left <= 0) return undefined;
    const timer = setTimeout(() => setLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [left]);
  return [left, setLeft];
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
