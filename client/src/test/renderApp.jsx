import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '../App.jsx';
import { AuthProvider } from '../context/AuthContext.jsx';
import { ToastProvider } from '../context/ToastContext.jsx';
import { ApiError } from '../lib/api.js';

export const asha = { id: 'u1', email: 'asha@example.com', name: 'Asha Kulkarni', emailVerified: true, isSeller: false, storeName: null, avatarUrl: null };

/** A fake auth API where every call is a spy. Pass overrides per test. */
export function fakeApi(overrides = {}) {
  const guest = () => Promise.reject(new ApiError(401, 'UNAUTHENTICATED', 'Please sign in.'));
  return {
    me: vi.fn(guest),
    register: vi.fn().mockResolvedValue({ message: 'sent' }),
    verifyEmail: vi.fn().mockResolvedValue({ user: asha }),
    resendVerification: vi.fn().mockResolvedValue({ message: 'sent' }),
    login: vi.fn().mockResolvedValue({ user: asha }),
    requestLoginCode: vi.fn().mockResolvedValue({ message: 'sent' }),
    verifyLoginCode: vi.fn().mockResolvedValue({ user: asha }),
    forgot: vi.fn().mockResolvedValue({ message: 'sent' }),
    reset: vi.fn().mockResolvedValue({ user: asha }),
    google: vi.fn().mockResolvedValue({ user: asha }),
    logout: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
}

export function renderApp({ route = '/', api = fakeApi(), state } = {}) {
  const entry = state ? { pathname: route, state } : route;
  const utils = render(
    <MemoryRouter initialEntries={[entry]}>
      <ToastProvider>
        <AuthProvider api={api}>
          <App />
        </AuthProvider>
      </ToastProvider>
    </MemoryRouter>,
  );
  return { api, ...utils };
}
