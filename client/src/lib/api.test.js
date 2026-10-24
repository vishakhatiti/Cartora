import { describe, it, expect, vi, afterEach } from 'vitest';
import { apiFetch, ApiError } from './api.js';

afterEach(() => vi.unstubAllGlobals());
const respond = (status, body) => vi.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

describe('apiFetch', () => {
  it('sends JSON with the cookie policy and parses the answer', async () => {
    const fetchMock = respond(200, { ok: 1 });
    vi.stubGlobal('fetch', fetchMock);
    expect(await apiFetch('/x', { method: 'POST', body: { a: 1 } })).toEqual({ ok: 1 });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/x');
    expect(init).toMatchObject({ method: 'POST', credentials: 'same-origin', body: '{"a":1}' });
    expect(init.headers['Content-Type']).toBe('application/json');
  });

  it('returns null for 204', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 204 }));
    expect(await apiFetch('/auth/logout', { method: 'POST' })).toBeNull();
  });

  it('turns an error body into an ApiError with the server message and code', async () => {
    vi.stubGlobal('fetch', respond(401, { error: { code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' } }));
    const err = await apiFetch('/auth/login', { method: 'POST', body: {} }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ status: 401, code: 'INVALID_CREDENTIALS', message: 'Incorrect email or password.' });
  });

  it('gives a plain message when the server sends no JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 502, json: async () => { throw new Error('html'); } }));
    const err = await apiFetch('/x').catch((e) => e);
    expect(err.status).toBe(502);
    expect(err.message).toMatch(/try again/i);
  });

  it('reports an unreachable server as NETWORK without leaking internals', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    const err = await apiFetch('/x').catch((e) => e);
    expect(err).toMatchObject({ status: 0, code: 'NETWORK' });
    expect(err.message).not.toMatch(/fetch/i);
  });
});
