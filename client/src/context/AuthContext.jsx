import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../lib/api.js';

const AuthContext = createContext(null);

/**
 * Who is signed in. The session lives in an httpOnly cookie the page cannot read, so the only way to know
 * is to ask the server (GET /api/auth/me). status is 'loading' until that first answer arrives.
 */
export function AuthProvider({ children, api = authApi }) {
  const [state, setState] = useState({ user: null, status: 'loading' });

  useEffect(() => {
    const controller = new AbortController();
    api.me(controller.signal)
      .then((data) => setState({ user: data.user, status: 'ready' }))
      .catch((err) => {
        if (err?.name === 'AbortError') return;
        // 401 just means "nobody is signed in". Any other failure also leaves the visitor as a guest.
        setState({ user: null, status: 'ready' });
      });
    return () => controller.abort();
  }, [api]);

  const setUser = useCallback((user) => setState({ user, status: 'ready' }), []);

  const signOut = useCallback(async () => {
    try {
      await api.logout();
    } finally {
      setState({ user: null, status: 'ready' });
    }
  }, [api]);

  const value = useMemo(() => ({ ...state, api, setUser, signOut }), [state, api, setUser, signOut]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
