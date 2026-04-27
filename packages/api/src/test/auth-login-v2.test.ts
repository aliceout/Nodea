/**
 * Integration tests for the OPAQUE 2-step login flow + the
 * activation gate (Auth-Roadmap Phase 2C).
 *
 * Routes under test:
 *   - POST /auth/login/start   (OPAQUE step 1, anti-enum)
 *   - POST /auth/login/finish  (OPAQUE step 2, session emission)
 *
 * Real Postgres + the in-memory `RecordingEmailService`. The OPAQUE
 * client side runs in-process via `@serenity-kit/opaque`.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import { TEST_PASSWORD, extractCookie, seedUser } from './helpers.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

interface StartResult {
  status: number;
  loginResponse?: string;
  loginToken?: string;
  clientLoginState?: string;
}

async function callLoginStart(
  email: string,
  password: string,
): Promise<StartResult> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const res = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (res.status !== 200) return { status: res.status };
  const { loginResponse, loginToken } = (await res.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  return { status: 200, loginResponse, loginToken, clientLoginState };
}

/* ============================================================================
 * POST /auth/login/start
 * ========================================================================== */

describe('POST /auth/login/start', () => {
  it('returns a loginResponse + loginToken for a known identifier', async () => {
    await seedUser('login-known@example.com');
    const start = await callLoginStart('login-known@example.com', TEST_PASSWORD);
    expect(start.status).toBe(200);
    expect(start.loginResponse).toBeTypeOf('string');
    expect(start.loginToken).toBeTypeOf('string');
    expect(start.loginToken!.length).toBeGreaterThan(20);
  });

  it('returns an indistinguishable response for an unknown identifier (anti-enum)', async () => {
    // No seedUser — the email is unknown. The server must still
    // respond with a syntactically valid loginResponse + a fresh
    // loginToken so the response shape is identical between known
    // and unknown identifiers.
    const start = await callLoginStart('ghost@example.com', TEST_PASSWORD);
    expect(start.status).toBe(200);
    expect(start.loginResponse).toBeTypeOf('string');
    expect(start.loginToken).toBeTypeOf('string');

    // The client's finishLogin would reject this `loginResponse`
    // because no real OPAQUE record was used to produce it. We let
    // /finish handle that case with the standard invalid_credentials
    // error.
  });

  it('rejects 400 invalid_body on a malformed startLoginRequest', async () => {
    await seedUser('login-malformed@example.com');
    const res = await app.request(
      '/auth/login/start',
      jsonPost({
        email: 'login-malformed@example.com',
        startLoginRequest: 'not-a-real-opaque-blob',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });

  it('rejects 400 invalid_body on a missing field', async () => {
    const res = await app.request(
      '/auth/login/start',
      jsonPost({ email: 'no-blob@example.com' }),
    );
    expect(res.status).toBe(400);
  });
});

/* ============================================================================
 * POST /auth/login/finish
 * ========================================================================== */

describe('POST /auth/login/finish', () => {
  it('emits a session cookie for the right password', async () => {
    await seedUser('login-finish@example.com');
    const start = await callLoginStart('login-finish@example.com', TEST_PASSWORD);
    expect(start.status).toBe(200);

    const finished = client.finishLogin({
      password: TEST_PASSWORD,
      clientLoginState: start.clientLoginState!,
      loginResponse: start.loginResponse!,
    });
    expect(finished).toBeDefined();

    const res = await app.request(
      '/auth/login/finish',
      jsonPost({
        loginToken: start.loginToken,
        finishLoginRequest: finished!.finishLoginRequest,
      }),
    );
    expect(res.status).toBe(200);
    expect(extractCookie(res)).toBeTruthy();
  });

  it('rejects 401 invalid_credentials when the client sends a tampered finishLoginRequest', async () => {
    await seedUser('login-tamper@example.com');
    const start = await callLoginStart('login-tamper@example.com', TEST_PASSWORD);

    const finished = client.finishLogin({
      password: TEST_PASSWORD,
      clientLoginState: start.clientLoginState!,
      loginResponse: start.loginResponse!,
    });

    // Tamper one base64 char in the middle of the request — auth-tag
    // mismatch on the server side.
    const tampered = (finished!.finishLoginRequest.charAt(20) === 'A' ? 'B' : 'A') +
      finished!.finishLoginRequest.slice(1);

    const res = await app.request(
      '/auth/login/finish',
      jsonPost({
        loginToken: start.loginToken,
        finishLoginRequest: tampered,
      }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ error: 'invalid_credentials' });
  });

  it('rejects 401 invalid_credentials when the loginToken is unknown / replayed', async () => {
    await seedUser('login-replay@example.com');
    const start = await callLoginStart('login-replay@example.com', TEST_PASSWORD);
    const finished = client.finishLogin({
      password: TEST_PASSWORD,
      clientLoginState: start.clientLoginState!,
      loginResponse: start.loginResponse!,
    });

    // First /finish consumes the token successfully.
    const first = await app.request(
      '/auth/login/finish',
      jsonPost({
        loginToken: start.loginToken,
        finishLoginRequest: finished!.finishLoginRequest,
      }),
    );
    expect(first.status).toBe(200);

    // Second call with the same token must fail — single-use.
    const second = await app.request(
      '/auth/login/finish',
      jsonPost({
        loginToken: start.loginToken,
        finishLoginRequest: finished!.finishLoginRequest,
      }),
    );
    expect(second.status).toBe(401);
    expect(await second.json()).toMatchObject({ error: 'invalid_credentials' });
  });

  it('refuses inactive accounts with 403 account_not_activated', async () => {
    const u = await seedUser('inactive-login@example.com');
    await db.update(users).set({ emailVerifiedAt: null }).where(eq(users.id, u.id));

    const start = await callLoginStart('inactive-login@example.com', TEST_PASSWORD);
    expect(start.status).toBe(200);
    const finished = client.finishLogin({
      password: TEST_PASSWORD,
      clientLoginState: start.clientLoginState!,
      loginResponse: start.loginResponse!,
    });

    const res = await app.request(
      '/auth/login/finish',
      jsonPost({
        loginToken: start.loginToken,
        finishLoginRequest: finished!.finishLoginRequest,
      }),
    );
    expect(res.status).toBe(403);
    expect(await res.json()).toMatchObject({ error: 'account_not_activated' });
  });

  it('client.finishLogin returns undefined for the wrong password (anti-enum)', async () => {
    // The known-user case: server returns a real loginResponse, but
    // the client's password doesn't match. `finishLogin` returns
    // undefined client-side — no point posting /finish at all.
    await seedUser('login-wrong@example.com');
    const start = await callLoginStart('login-wrong@example.com', 'wrong-password-1234');
    expect(start.status).toBe(200);
    const finished = client.finishLogin({
      password: 'wrong-password-1234',
      clientLoginState: start.clientLoginState!,
      loginResponse: start.loginResponse!,
    });
    expect(finished).toBeUndefined();
  });
});
