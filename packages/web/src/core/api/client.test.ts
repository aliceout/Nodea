/**
 * Unit tests for the API client. We don't spin up a real server here;
 * Phase 2 already covers the server contract. These tests verify the
 * client:
 *   - sends the right method / path / body / credentials
 *   - parses successful JSON
 *   - translates non-2xx into a typed ApiError
 *   - maps 401 on /auth/me to `null` (the session-is-absent signal)
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { apiLogin, apiMe, apiLogout, isApiError } from './client.ts';

// Give the client a URL by setting the env var our module reads.
vi.stubEnv('VITE_API_URL', 'http://test.local');

function mockFetchOnce(
  body: unknown,
  init: { status?: number; headers?: HeadersInit } = {},
): void {
  const responseInit: ResponseInit = { status: init.status ?? 200 };
  if (init.headers) responseInit.headers = init.headers;
  const response = new Response(body !== undefined ? JSON.stringify(body) : '', responseInit);
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
}

describe('API client', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('apiLogin POSTs to /auth/login with credentials and JSON body', async () => {
    const spy = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: 'u1' }), { status: 200 }));
    vi.stubGlobal('fetch', spy);

    const result = await apiLogin({ email: 'a@b.co', password: 'pw-whatever-123456' });
    expect(result).toEqual({ id: 'u1' });

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('http://test.local/auth/login');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({
      email: 'a@b.co',
      password: 'pw-whatever-123456',
    });
    expect((init.headers as Record<string, string>)['content-type']).toBe('application/json');
  });

  it('apiLogout POSTs with no body', async () => {
    const spy = vi.fn().mockResolvedValue(new Response('', { status: 200 }));
    vi.stubGlobal('fetch', spy);

    await apiLogout();
    const [, init] = spy.mock.calls[0]!;
    expect(init.method).toBe('POST');
    expect(init.body).toBeUndefined();
  });

  it('apiMe returns the parsed response on 200', async () => {
    mockFetchOnce({
      id: 'u1',
      email: 'a@b.co',
      role: 'user',
      onboardingStatus: 'complete',
      onboardingVersion: '1',
      encryptionSalt: 's',
      encryptedKey: 'k',
    });

    const me = await apiMe();
    expect(me?.email).toBe('a@b.co');
  });

  it('apiMe returns null on 401 (session absent)', async () => {
    mockFetchOnce({ error: 'unauthenticated' }, { status: 401 });
    const me = await apiMe();
    expect(me).toBeNull();
  });

  it('non-2xx throws a typed ApiError with status + error + reason', async () => {
    mockFetchOnce({ error: 'weak_password', reason: 'too short' }, { status: 400 });

    const err = await apiLogin({ email: 'a@b.co', password: 'x' }).catch((e) => e);
    expect(isApiError(err)).toBe(true);
    expect(err.status).toBe(400);
    expect(err.error).toBe('weak_password');
    expect(err.reason).toBe('too short');
  });
});
