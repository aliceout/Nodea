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
import {
  apiLoginStart,
  apiLogout,
  apiMe,
  isApiError,
} from './client.ts';

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

  it('apiLoginStart POSTs to /auth/login/start with credentials + JSON body', async () => {
    const spy = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ loginResponse: 'opaque-blob', loginToken: 'token-abc' }),
        { status: 200 },
      ),
    );
    vi.stubGlobal('fetch', spy);

    const result = await apiLoginStart({
      email: 'a@b.co',
      startLoginRequest: 'opaque-ke1',
    });
    expect(result).toEqual({ loginResponse: 'opaque-blob', loginToken: 'token-abc' });

    expect(spy).toHaveBeenCalledOnce();
    const [url, init] = spy.mock.calls[0]!;
    expect(url).toBe('http://test.local/auth/login/start');
    expect(init.method).toBe('POST');
    expect(init.credentials).toBe('include');
    expect(JSON.parse(init.body)).toEqual({
      email: 'a@b.co',
      startLoginRequest: 'opaque-ke1',
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
      username: null,
      role: 'user',
      onboardingStatus: 'complete',
      onboardingVersion: '1',
      wrappedMainKey: null,
      wrappedMainKeyIv: null,
      wrappedKekPassword: null,
      wrappedKekPasswordIv: null,
      recoveryCodeSet: false,
      passkeysCount: 0,
      passkeysPrfCount: 0,
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
    mockFetchOnce({ error: 'invalid_credentials' }, { status: 401 });

    const err = await apiLoginStart({
      email: 'a@b.co',
      startLoginRequest: 'opaque-ke1',
    }).catch((e: unknown) => e);
    expect(isApiError(err)).toBe(true);
    if (isApiError(err)) {
      expect(err.status).toBe(401);
      expect(err.error).toBe('invalid_credentials');
    }
  });
});
