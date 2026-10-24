import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import GoogleButton from '../components/GoogleButton.jsx';
import { Button, EMAIL_PATTERN, Field, FormError } from '../components/forms.jsx';
import AuthShell, { GuestLink, OrDivider } from './AuthShell.jsx';
import CodeStep from './CodeStep.jsx';
import useFinishSignIn from './useFinishSignIn.js';

function PasswordForm({ onDone }) {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!EMAIL_PATTERN.test(email.trim())) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      const { user } = await api.login({ email: email.trim(), password });
      onDone(user);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED') {
        // Send them to the verification step, which asks for a fresh code.
        navigate('/register', { state: { verifyEmail: email.trim().toLowerCase() } });
        return;
      }
      setFormError(err.message);
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
      <Field label="Password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} error={errors.password} />
      <FormError>{formError}</FormError>
      <Button type="submit" busy={busy}>Sign in</Button>
      <p className="text-right text-sm">
        <Link to="/forgot" className="font-medium text-primary underline-offset-2 hover:underline">Forgot your password?</Link>
      </p>
    </form>
  );
}

function EmailCodeForm({ onDone }) {
  const { api } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const request = async (e) => {
    e.preventDefault();
    if (!EMAIL_PATTERN.test(email.trim())) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api.requestLoginCode({ email: email.trim() });
      setSentTo(email.trim().toLowerCase());
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sentTo) {
    return (
      <CodeStep
        email={sentTo}
        submitLabel="Sign in"
        onSubmit={async (code) => onDone((await api.verifyLoginCode({ email: sentTo, code })).user)}
        onResend={() => api.requestLoginCode({ email: sentTo })}
        onChangeEmail={() => setSentTo(null)}
      />
    );
  }
  return (
    <form onSubmit={request} noValidate className="space-y-4">
      <Field label="Email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} hint="We will email you a 6-digit code. No password needed." />
      <FormError>{error}</FormError>
      <Button type="submit" busy={busy}>Email me a code</Button>
    </form>
  );
}

const TABS = [
  { id: 'password', label: 'Password' },
  { id: 'code', label: 'Email code' },
];

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

export default function SignInPage() {
  const { user, api } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const finish = useFinishSignIn();
  const [tab, setTab] = useState('password');
  const [googleError, setGoogleError] = useState('');

  if (user) return <Navigate to={location.state?.from ?? '/'} replace />;

  const onGoogle = async (credential) => {
    setGoogleError('');
    try {
      finish((await api.google(credential)).user);
    } catch (err) {
      setGoogleError(err.message);
      toast.error(err.message);
    }
  };

  return (
    <AuthShell
      title="Sign in"
      subtitle="Welcome back to Cartora."
      footer={
        <>
          New here?{' '}
          <Link to="/register" className="font-medium text-primary underline-offset-2 hover:underline">Create an account</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <GuestLink />
        </>
      }
    >
      {GOOGLE_CLIENT_ID && (
        <>
          <GoogleButton onCredential={onGoogle} clientId={GOOGLE_CLIENT_ID} />
          <FormError>{googleError}</FormError>
          <OrDivider />
        </>
      )}
      <div role="tablist" aria-label="Sign-in method" className="grid grid-cols-2 gap-1 rounded-xl bg-bg p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            aria-selected={tab === t.id}
            aria-controls={`panel-${t.id}`}
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${tab === t.id ? 'bg-surface shadow-sm' : 'text-muted hover:text-fg'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'password' ? <PasswordForm onDone={(u) => finish(u)} /> : <EmailCodeForm onDone={(u) => finish(u)} />}
      </div>
    </AuthShell>
  );
}
