import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, EMAIL_PATTERN, Field, FormError } from '../components/forms.jsx';
import AuthShell from './AuthShell.jsx';
import CodeStep from './CodeStep.jsx';
import useFinishSignIn from './useFinishSignIn.js';

export default function ForgotPage() {
  const { user, api } = useAuth();
  const finish = useFinishSignIn();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  const request = async (e) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.forgot({ email: email.trim() });
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    const valid = newPassword.length >= 8 && newPassword.length <= 128;
    return (
      <AuthShell title="Set a new password" subtitle="Signing in again will sign out your other devices.">
        <CodeStep
          email={sentTo}
          submitLabel="Update password"
          extraValid={valid}
          onSubmit={async (code) => finish((await api.reset({ email: sentTo, code, newPassword })).user, 'Password updated. You are signed in.')}
          onResend={() => api.forgot({ email: sentTo })}
          onChangeEmail={() => setSentTo(null)}
        >
          <Field label="New password" type="password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} hint="8 to 128 characters." />
        </CodeStep>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter your email and we will send a code."
      footer={<Link to="/sign-in" className="font-medium text-primary underline-offset-2 hover:underline">Back to sign in</Link>}
    >
      <form onSubmit={request} noValidate className="space-y-4">
        <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <FormError>{error}</FormError>
        <Button type="submit" busy={busy}>Email me a code</Button>
      </form>
    </AuthShell>
  );
}
