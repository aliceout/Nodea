import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { buildApp } from '../app.ts';
import { loginAs, seedUser, TEST_PASSWORD } from './helpers.ts';

const app = buildApp();

/**
 * Runtime opacity contract — exercise a real mutation flow through
 * the full `buildApp()` (including `hono/logger()` + the redactor)
 * and assert the captured stdout never leaks a guard, an HMAC-y
 * hex blob, or a magic-link token.
 *
 * This is the safety net that catches a regression where someone :
 *   - re-introduces `?d=` / `?sid=` in a route, or
 *   - widens `hono/logger()` to dump headers / bodies, or
 *   - removes `redactingPrintFunc` from the logger init.
 *
 * The test is integration-grade : `app.request()` actually runs the
 * full middleware chain. The only stub is `console.log` (since the
 * api currently logs to stdout) ; the redactor is exercised
 * end-to-end.
 */
describe('Runtime opacity — request logs', () => {
  let logSpy: ReturnType<typeof vi.spyOn>;
  const captured: string[] = [];

  beforeEach(() => {
    captured.length = 0;
    logSpy = vi.spyOn(console, 'log').mockImplementation((...args) => {
      captured.push(args.map((a) => String(a)).join(' '));
    });
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('does not leak the X-Guard / X-Sid headers in the request log', async () => {
    const email = 'opacity@example.com';
    await seedUser(email);
    const cookie = await loginAs(app, email, TEST_PASSWORD);

    // Create + promote a Mood entry — the canonical case where
    // the guard travels with the request.
    const sid = 'sid-opacity-' + Date.now();
    const created = await app.request('/mood/records', {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        sid,
        cipher_iv: 'iv-opacity',
        payload: 'payload-opacity',
        guard: 'init',
      }),
    });
    expect(created.status).toBe(201);
    const { id } = (await created.json()) as { id: string };

    const fakeGuard = 'g_' + 'f'.repeat(64);
    const promoted = await app.request(`/mood/records/${id}`, {
      method: 'PATCH',
      headers: {
        'content-type': 'application/json',
        cookie,
        'x-sid': sid,
        'x-guard': 'init',
      },
      body: JSON.stringify({ guard: fakeGuard }),
    });
    expect(promoted.status).toBe(200);

    // Now the assertions. Each captured log line MUST NOT contain :
    //   - the literal sid value,
    //   - the literal guard value (init or the fake),
    //   - any leftover `?d=` / `?sid=` (which would mean someone
    //     re-introduced query-string auth params).
    const allLogs = captured.join('\n');

    expect(allLogs).not.toContain(sid);
    expect(allLogs).not.toContain(fakeGuard);
    // `init` is too generic to assert on directly (it might appear
    // in a path or status name), but a guard-shaped value never
    // should.
    expect(allLogs).not.toMatch(/g_[0-9a-f]{16,}/);
    // No raw `d=<something>` or `sid=<something>` query param in the
    // log stream — even if the redactor missed one, this catches it.
    expect(allLogs).not.toMatch(/[?&](?:d|sid|guard)=[^&\s_]/);
  });

  it('does not leak the request body of an /auth route', async () => {
    // /auth/login/start receives an OPAQUE blob ; it must never
    // appear in stdout. The api already does NOT log bodies, but
    // we assert the contract holds end-to-end so a regression that
    // turns on body-logging would fail here.
    const res = await app.request('/auth/login/start', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody@example.com',
        client_login_start: 'OPAQUE_TEST_BLOB_THAT_SHOULD_NEVER_BE_LOGGED',
      }),
    });
    // 4xx is fine — we just want the request to reach the logger.
    expect([200, 400, 401, 404, 429]).toContain(res.status);

    const allLogs = captured.join('\n');
    expect(allLogs).not.toContain('OPAQUE_TEST_BLOB_THAT_SHOULD_NEVER_BE_LOGGED');
  });
});
