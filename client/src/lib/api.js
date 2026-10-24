// In development Vite proxies /api to the local server. In production Vercel rewrites /api to Render,
// so the browser always talks to the same origin and the session cookie is first-party.
const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// Render's free tier sleeps when idle and can take about a minute to wake up.
const TIMEOUT_MS = 60000;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

/** JSON request to the API. Throws ApiError with a message that is safe to show to the user. */
export async function apiFetch(path, { method = 'GET', body, signal } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers: { Accept: 'application/json', ...(body !== undefined && { 'Content-Type': 'application/json' }) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError' && signal?.aborted) throw err; // the caller cancelled: not an error to show
    throw new ApiError(0, 'NETWORK', 'Cartora could not be reached. Check your connection and try again.');
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 204) return null;
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON body */
  }
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'ERROR', data?.error?.message ?? 'Something went wrong. Please try again.');
  }
  return data;
}

export const authApi = {
  me: (signal) => apiFetch('/auth/me', { signal }),
  register: (body) => apiFetch('/auth/register', { method: 'POST', body }),
  verifyEmail: (body) => apiFetch('/auth/verify-email', { method: 'POST', body }),
  resendVerification: (body) => apiFetch('/auth/resend-verification', { method: 'POST', body }),
  login: (body) => apiFetch('/auth/login', { method: 'POST', body }),
  requestLoginCode: (body) => apiFetch('/auth/login-code/request', { method: 'POST', body }),
  verifyLoginCode: (body) => apiFetch('/auth/login-code/verify', { method: 'POST', body }),
  forgot: (body) => apiFetch('/auth/forgot', { method: 'POST', body }),
  reset: (body) => apiFetch('/auth/reset', { method: 'POST', body }),
  google: (credential) => apiFetch('/auth/google', { method: 'POST', body: { credential } }),
  logout: () => apiFetch('/auth/logout', { method: 'POST' }),
};

/**
 * Check the API. Returns one of:
 *   'ready'        the API is up and MongoDB is connected
 *   'db_down'      the API is up but MongoDB is not connected
 *   'unreachable'  no usable response (offline, still waking up, or misconfigured)
 */
export async function fetchApiStatus(signal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  signal?.addEventListener('abort', () => controller.abort(), { once: true });
  try {
    const res = await fetch(`${BASE}/health/ready`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });
    if (res.ok) return 'ready';
    if (res.status === 503) return 'db_down';
    return 'unreachable';
  } catch {
    return 'unreachable';
  } finally {
    clearTimeout(timer);
  }
}
