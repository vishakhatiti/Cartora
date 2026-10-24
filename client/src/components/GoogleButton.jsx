import { useEffect, useRef, useState } from 'react';
import { loadGoogleIdentity } from '../lib/googleIdentity.js';

const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;

/**
 * Google's own sign-in button (Google Identity Services). It hands us a signed ID token, which the server
 * verifies. Nothing is shown when VITE_GOOGLE_CLIENT_ID is not set, so there is never a dead button.
 */
export default function GoogleButton({ onCredential, clientId = CLIENT_ID, load = loadGoogleIdentity }) {
  const holder = useRef(null);
  const callback = useRef(onCredential);
  const [failed, setFailed] = useState(false);
  callback.current = onCredential;

  useEffect(() => {
    if (!clientId) return undefined;
    let cancelled = false;
    load()
      .then((google) => {
        if (cancelled || !holder.current) return;
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (response) => callback.current(response.credential),
        });
        const width = Math.min(360, Math.max(200, holder.current.offsetWidth || 320));
        google.accounts.id.renderButton(holder.current, { type: 'standard', theme: 'outline', size: 'large', text: 'continue_with', width });
      })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
  }, [clientId, load]);

  if (!clientId) return null;
  if (failed) return <p className="text-center text-sm text-muted">Google sign-in is unavailable right now. Use email instead.</p>;
  return <div ref={holder} className="flex min-h-11 justify-center" data-testid="google-button" />;
}
