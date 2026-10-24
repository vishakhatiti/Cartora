import { useState } from 'react';
import { Button, CodeField, FormError, useCountdown } from '../components/forms.jsx';

const RESEND_SECONDS = 60;

/**
 * Asks for the emailed code (plus optional extra fields such as a new password). The resend button counts
 * down to match the server's 60 second limit between codes.
 */
export default function CodeStep({ email, onSubmit, onResend, onChangeEmail, submitLabel, children, extraValid = true }) {
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [resendNote, setResendNote] = useState('');
  const [left, setLeft] = useCountdown(RESEND_SECONDS);

  const submit = async (e) => {
    e.preventDefault();
    if (!/^\d{6}$/.test(code)) {
      setError('Enter the 6-digit code from the email.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await onSubmit(code);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  const resend = async () => {
    setResendNote('');
    setError('');
    try {
      await onResend();
      setLeft(RESEND_SECONDS);
      setResendNote('If the address can be used, a new code is on its way.');
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <p className="text-sm text-muted">
        We emailed a code to <strong className="text-fg">{email}</strong>. It works for 10 minutes.
      </p>
      <CodeField value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))} autoFocus />
      {children}
      <FormError>{error}</FormError>
      {resendNote && <p role="status" className="text-sm text-muted">{resendNote}</p>}
      <Button type="submit" busy={busy} disabled={!extraValid}>{submitLabel}</Button>
      <div className="flex items-center justify-between text-sm">
        <button type="button" onClick={resend} disabled={left > 0} className="font-medium text-primary underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:text-muted disabled:no-underline">
          {left > 0 ? `Send a new code in ${left}s` : 'Send a new code'}
        </button>
        <button type="button" onClick={onChangeEmail} className="text-muted underline-offset-2 hover:underline">
          Use a different email
        </button>
      </div>
    </form>
  );
}
