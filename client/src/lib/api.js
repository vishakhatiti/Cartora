// In development Vite proxies /api to the local server. In production Vercel rewrites /api to Render,
// so the browser always talks to the same origin. VITE_API_BASE_URL can override this if ever needed.
const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

// Render's free tier sleeps when idle and can take about a minute to wake up.
const TIMEOUT_MS = 60000;

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
