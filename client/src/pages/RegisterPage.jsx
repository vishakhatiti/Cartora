import { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Button, EMAIL_PATTERN, Field, FormError } from '../components/forms.jsx';
import AuthShell, { GuestLink } from './AuthShell.jsx';
import CodeStep from './CodeStep.jsx';
import useFinishSignIn from './useFinishSignIn.js';

export default function RegisterPage() {
  const { user, api } = useAuth();
  const location = useLocation();
  const finish = useFinishSignIn();
  // Arriving from sign-in with an unverified account skips straight to the code step.
  const [pendingEmail, setPendingEmail] = useState(location.state?.verifyEmail ?? null);
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);
  const askedForNewCode = useRef(false);

  useEffect(() => {
    if (location.state?.verifyEmail && !askedForNewCode.current) {
      askedForNewCode.current = true;
      api.resendVerification({ email: location.state.verifyEmail }).catch(() => {});
    }
  }, [api, location.state]);

  if (user) return <Navigate to="/" replace />;

  const set = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const next = {};
    if (!values.name.trim()) next.name = 'Enter your name.';
    if (!EMAIL_PATTERN.test(values.email.trim())) next.email = 'Enter a valid email address.';
    if (values.password.length < 8) next.password = 'Use at least 8 characters.';
    else if (values.password.length > 128) next.password = 'Use at most 128 characters.';
    setErrors(next);
    setFormError('');
    if (Object.keys(next).length) return;
    setBusy(true);
    try {
      await api.register({ name: values.name.trim(), email: values.email.trim(), password: values.password });
      setPendingEmail(values.email.trim().toLowerCase());
    } catch (err) {
      setFormError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (pendingEmail) {
    return (
      <AuthShell title="Check your email" subtitle="Confirm your address to finish creating your account.">
        <CodeStep
          email={pendingEmail}
          submitLabel="Verify and continue"
          onSubmit={async (code) => finish((await api.verifyEmail({ email: pendingEmail, code })).user, 'Email verified. Welcome to Cartora.')}
          onResend={() => api.resendVerification({ email: pendingEmail })}
          onChangeEmail={() => setPendingEmail(null)}
        />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title="Create your account"
      subtitle="Buy and sell with one login."
      footer={
        <>
          Already have an account?{' '}
          <Link to="/sign-in" className="font-medium text-primary underline-offset-2 hover:underline">Sign in</Link>
          <span className="mx-2" aria-hidden="true">/</span>
          <GuestLink />
        </>
      }
    >
      <form onSubmit={submit} noValidate className="space-y-4">
        <Field label="Name" autoComplete="name" value={values.name} onChange={set('name')} error={errors.name} />
        <Field label="Email" type="email" autoComplete="email" value={values.email} onChange={set('email')} error={errors.email} />
        <Field label="Password" type="password" autoComplete="new-password" value={values.password} onChange={set('password')} error={errors.password} hint="8 to 128 characters." />
        <FormError>{formError}</FormError>
        <Button type="submit" busy={busy}>Create account</Button>
      </form>
    </AuthShell>
  );
}
