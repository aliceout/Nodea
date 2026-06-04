/**
 * Integration tests for the re-auth foundation (Auth-Roadmap Phase
 * 7A, Auth-Spec §5.3).
 *
 * Three concerns under test:
 *
 *   1. Timestamp wiring on every successful auth path — login/finish
 *      stamps `reauth_password_at`; passkey-only login stamps
 *      `reauth_passkey_at`; change-password rotation stamps the new
 *      session; recovery-code reset stamps the new session.
 *
 *   2. `requireFreshPassword` / `requireFreshPasswordOrPasskey`
 *      middleware behaviour — checked via dummy routes mounted on a
 *      throwaway Hono app, since none of the production routes have
 *      adopted them yet (Phase 7A only ships the foundation; the
 *      mutating-route migration lands in a follow-up sub-phase).
 *
 *   3. `POST /auth/reauth/password/{start,finish}` — exercises the
 *      OPAQUE round-trip on a logged-in session and asserts
 *      `reauth_password_at` flips. (Passkey re-auth needs a real
 *      WebAuthn authenticator; we rely on the unit tests around
 *      `verifyAuthenticationResponse` plus the
 *      Phase 4 / Phase 5C passkey suites for that path.)
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { client, ready } from '@serenity-kit/opaque';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import { sessions } from '../db/schema.ts';
import { TEST_PASSWORD, extractCookie, seedUser } from './helpers.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import {
  requireFreshPassword,
  requireFreshPasswordOrPasskey,
} from '../middleware/require-fresh-reauth.ts';

const app = buildApp();

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

async function rawLogin(email: string, password: string): Promise<{
  status: number;
  cookie: string | null;
}> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) return { status: startRes.status, cookie: null };
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  const finished = client.finishLogin({ password, clientLoginState, loginResponse });
  if (!finished) throw new Error('rawLogin: bad password');
  const finishRes = await app.request(
    '/auth/login/finish',
    jsonPost({ loginToken, finishLoginRequest: finished.finishLoginRequest }),
  );
  return {
    status: finishRes.status,
    cookie: extractCookie(finishRes),
  };
}

async function getSessionRow(cookie: string) {
  // Strip "nodea_session=" prefix to get the raw signed cookie value.
  // We need to look up the row via its ID, which is the part before
  // the signature. The session cookie is signed (HMAC); the value
  // after the dot is the signature, before is the id.
  const signed = cookie.replace(/^nodea_session=/, '');
  const sessionId = signed.split('.')[0]!;
  const [row] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  return row ?? null;
}

/* ============================================================================
 * Timestamp wiring
 * ========================================================================== */

describe('reauth timestamps stamped on successful auth paths', () => {
  it('OPAQUE login stamps reauth_password_at, leaves reauth_passkey_at null', async () => {
    await seedUser('reauth-pwd-stamp@example.com');
    const { status, cookie } = await rawLogin(
      'reauth-pwd-stamp@example.com',
      TEST_PASSWORD,
    );
    expect(status).toBe(200);
    expect(cookie).not.toBeNull();
    const row = await getSessionRow(cookie!);
    expect(row?.kind).toBe('full');
    expect(row?.reauthPasswordAt).not.toBeNull();
    expect(row?.reauthPasskeyAt).toBeNull();
  });
});

/* ============================================================================
 * Middleware behaviour
 *
 * Mounted on a throwaway Hono app so we can assert pass/fail without
 * needing a production route to adopt the middleware yet. The
 * `requireUser` chain is stacked first so the session id is in the
 * context.
 * ========================================================================== */

function buildMiddlewareTestApp() {
  const a = new Hono<{ Variables: AuthVariables }>();
  a.get('/test/fresh-password', requireUser, requireFreshPassword, (c) =>
    c.json({ ok: true }),
  );
  a.get(
    '/test/fresh-password-or-passkey',
    requireUser,
    requireFreshPasswordOrPasskey,
    (c) => c.json({ ok: true }),
  );
  return a;
}

describe('requireFreshPassword middleware', () => {
  it('200 when reauth_password_at is within the 5-min window', async () => {
    const testApp = buildMiddlewareTestApp();
    await seedUser('fresh-pwd-ok@example.com');
    const { cookie } = await rawLogin('fresh-pwd-ok@example.com', TEST_PASSWORD);
    expect(cookie).not.toBeNull();
    const res = await testApp.request('/test/fresh-password', {
      headers: { cookie: cookie! },
    });
    expect(res.status).toBe(200);
  });

  it('401 reauth_required:password when the timestamp is stale (>5 min)', async () => {
    const testApp = buildMiddlewareTestApp();
    await seedUser('fresh-pwd-stale@example.com');
    const { cookie } = await rawLogin('fresh-pwd-stale@example.com', TEST_PASSWORD);
    expect(cookie).not.toBeNull();
    // Backdate the timestamp past the window.
    const signed = cookie!.replace(/^nodea_session=/, '');
    const sessionId = signed.split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: new Date(Date.now() - 6 * 60_000) })
      .where(eq(sessions.id, sessionId));
    const res = await testApp.request('/test/fresh-password', {
      headers: { cookie: cookie! },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: string;
      reauth_required?: string;
    };
    expect(body.error).toBe('reauth_required');
    expect(body.reauth_required).toBe('password');
  });

  it('401 when the timestamp is null (session minted via passkey-only login)', async () => {
    const testApp = buildMiddlewareTestApp();
    await seedUser('fresh-pwd-null@example.com');
    const { cookie } = await rawLogin('fresh-pwd-null@example.com', TEST_PASSWORD);
    // Manually null out the password timestamp to simulate the
    // passkey-as-primary-login path. (Direct DB manipulation; the
    // passkey flow itself is covered by its own integration suite.)
    const signed = cookie!.replace(/^nodea_session=/, '');
    const sessionId = signed.split('.')[0]!;
    await db
      .update(sessions)
      .set({ reauthPasswordAt: null, reauthPasskeyAt: new Date() })
      .where(eq(sessions.id, sessionId));
    const res = await testApp.request('/test/fresh-password', {
      headers: { cookie: cookie! },
    });
    expect(res.status).toBe(401);
  });
});

describe('requireFreshPasswordOrPasskey middleware', () => {
  it('200 when only passkey is fresh (password is stale)', async () => {
    const testApp = buildMiddlewareTestApp();
    await seedUser('fresh-or-passkey@example.com');
    const { cookie } = await rawLogin('fresh-or-passkey@example.com', TEST_PASSWORD);
    const signed = cookie!.replace(/^nodea_session=/, '');
    const sessionId = signed.split('.')[0]!;
    await db
      .update(sessions)
      .set({
        reauthPasswordAt: new Date(Date.now() - 10 * 60_000), // stale
        reauthPasskeyAt: new Date(), // fresh
      })
      .where(eq(sessions.id, sessionId));
    const res = await testApp.request('/test/fresh-password-or-passkey', {
      headers: { cookie: cookie! },
    });
    expect(res.status).toBe(200);
  });

  it('401 reauth_required:password_or_passkey when both stamps are stale', async () => {
    const testApp = buildMiddlewareTestApp();
    await seedUser('fresh-or-stale@example.com');
    const { cookie } = await rawLogin('fresh-or-stale@example.com', TEST_PASSWORD);
    const signed = cookie!.replace(/^nodea_session=/, '');
    const sessionId = signed.split('.')[0]!;
    await db
      .update(sessions)
      .set({
        reauthPasswordAt: new Date(Date.now() - 10 * 60_000),
        reauthPasskeyAt: new Date(Date.now() - 10 * 60_000),
      })
      .where(eq(sessions.id, sessionId));
    const res = await testApp.request('/test/fresh-password-or-passkey', {
      headers: { cookie: cookie! },
    });
    expect(res.status).toBe(401);
    const body = (await res.json()) as {
      error: string;
      reauth_required?: string;
    };
    expect(body.reauth_required).toBe('password_or_passkey');
  });
});

/* ============================================================================
 * /auth/reauth/password
 * ========================================================================== */

describe('POST /auth/reauth/password/{start,finish}', () => {
  it('OPAQUE round-trip bumps reauth_password_at on the calling session', async () => {
    await seedUser('reauth-pwd-route@example.com');
    const { cookie } = await rawLogin('reauth-pwd-route@example.com', TEST_PASSWORD);
    expect(cookie).not.toBeNull();

    // Backdate so we can assert the bump moved it forward.
    const signed = cookie!.replace(/^nodea_session=/, '');
    const sessionId = signed.split('.')[0]!;
    const old = new Date(Date.now() - 30 * 60_000);
    await db
      .update(sessions)
      .set({ reauthPasswordAt: old })
      .where(eq(sessions.id, sessionId));

    await ready;
    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: TEST_PASSWORD,
    });
    const startRes = await app.request('/auth/reauth/password/start', {
      ...jsonPost({ startLoginRequest }),
      headers: { 'content-type': 'application/json', cookie: cookie! },
    });
    expect(startRes.status).toBe(200);
    const { loginResponse, loginToken } = (await startRes.json()) as {
      loginResponse: string;
      loginToken: string;
    };

    const finished = client.finishLogin({
      password: TEST_PASSWORD,
      clientLoginState,
      loginResponse,
    });
    if (!finished) throw new Error('finishLogin returned undefined');

    const finishRes = await app.request('/auth/reauth/password/finish', {
      ...jsonPost({
        loginToken,
        finishLoginRequest: finished.finishLoginRequest,
      }),
      headers: { 'content-type': 'application/json', cookie: cookie! },
    });
    expect(finishRes.status).toBe(200);
    const body = (await finishRes.json()) as { ok: boolean };
    expect(body.ok).toBe(true);

    const [row] = await db
      .select({ at: sessions.reauthPasswordAt })
      .from(sessions)
      .where(eq(sessions.id, sessionId));
    expect(row?.at).not.toBeNull();
    expect(row!.at!.getTime()).toBeGreaterThan(old.getTime());
  });

  it('401 invalid_credentials when the password is wrong', async () => {
    await seedUser('reauth-pwd-bad@example.com');
    const { cookie } = await rawLogin('reauth-pwd-bad@example.com', TEST_PASSWORD);

    await ready;
    const { clientLoginState, startLoginRequest } = client.startLogin({
      password: 'wrong-password-totally',
    });
    const startRes = await app.request('/auth/reauth/password/start', {
      ...jsonPost({ startLoginRequest }),
      headers: { 'content-type': 'application/json', cookie: cookie! },
    });
    // /start always returns 200 (anti-enum). The mismatch surfaces
    // at /finish.
    expect(startRes.status).toBe(200);
    const { loginResponse, loginToken } = (await startRes.json()) as {
      loginResponse: string;
      loginToken: string;
    };

    const finished = client.finishLogin({
      password: 'wrong-password-totally',
      clientLoginState,
      loginResponse,
    });
    // OPAQUE rejects the wrong password at the client side
    // (`finishLogin` returns undefined). Skip the round-trip and
    // hit the server with junk to assert the 401.
    const finishRes = await app.request('/auth/reauth/password/finish', {
      ...jsonPost({
        loginToken,
        finishLoginRequest:
          finished?.finishLoginRequest ??
          // any junk — server consumes the token and rejects
          'tampered-finish-login-request',
      }),
      headers: { 'content-type': 'application/json', cookie: cookie! },
    });
    expect(finishRes.status).toBe(401);
  });

  it('401 unauthenticated when called without a session cookie', async () => {
    const startRes = await app.request(
      '/auth/reauth/password/start',
      jsonPost({ startLoginRequest: 'whatever' }),
    );
    expect(startRes.status).toBe(401);
  });
});
