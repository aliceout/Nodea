/**
 * Vitest test setup + OPAQUE-aware test helpers (formerly in
 * `helpers.ts`).
 *
 * Why combined : Vitest 4 evaluates each `import`ed module inside the
 * importing test file's own module graph. Keeping seed / loginAs in
 * a separate `helpers.ts` left the `@serenity-kit/opaque` `client`
 * (loaded via helpers) and `server` (loaded via routes through
 * `app.ts`) sitting in two different module-cache scopes per test
 * file ; the cryptographic round-trip then failed because the two
 * WASM instances disagreed on protocol state. Pulling the helpers
 * into the same file that already registers the `beforeEach` /
 * `afterAll` hooks forces every consumer to import them via
 * `./setup.ts`, which keeps them in the test file's primary graph
 * alongside `buildApp()`.
 *
 * Production code never imports anything from `src/test/` (the
 * directory is excluded from the api Dockerfile + tsconfig build
 * step), so this file's contents have zero impact on the deployed
 * api — it's testing-only scaffolding.
 */
import { randomUUID } from 'node:crypto';
import { afterAll, beforeEach } from 'vitest';
import { client, ready } from '@serenity-kit/opaque';

import { sql, db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import { createInvite } from '../auth/invites.ts';
import { opaqueRegister } from '../auth/seed-crypto.ts';
import { __resetRateLimits } from '../middleware/rate-limit.ts';
import { __resetLoginStates } from '../auth/opaque-login-state.ts';
import { __resetOpaquePendingStates } from '../auth/opaque-pending-state.ts';
import { __resetRecoverStates } from '../auth/opaque-recover-state.ts';
import { __resetAlreadyExistsThrottle } from '../services/email/already-exists-throttle.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';

/* ============================================================================
 * Env guards
 * ========================================================================== */

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is required for tests. Run: pnpm --filter @nodea/api test via the wrapper that loads .env.test',
  );
}

// Issue #41 — refuse to run if DATABASE_URL doesn't target a `_test`
// database. The TRUNCATE below would otherwise nuke the dev rows on
// every test run (which is exactly how the admin user disappeared
// before this guard existed). `vitest.config.ts` auto-swaps the dbname
// in the dev URL, so this branch only fires when someone manually
// overrode DATABASE_URL via `.env.test` to a non-`_test` value.
if (!/\/[^/?]*_test(?:\?|$)/.test(process.env.DATABASE_URL)) {
  throw new Error(
    `Refusing to run tests against a non-test database. DATABASE_URL must end with a "_test" dbname (got: ${process.env.DATABASE_URL.replace(
      /:[^:@]+@/,
      ':***@',
    )}). See packages/api/vitest.config.ts and issue #41.`,
  );
}

/* ============================================================================
 * Constants
 * ========================================================================== */

export const TEST_PASSWORD = 'Correct-Horse-Battery-Staple-42';
export const ADMIN_PASSWORD = 'Admin-Horse-Battery-Staple-42';

/* ============================================================================
 * Lifecycle hooks — registered when this file is imported by a test
 * file (side effect). Each `import { ... } from './setup.ts'` triggers
 * evaluation, which registers a fresh `beforeEach` / `afterAll` for
 * that test file. Same DB connection pool, same in-memory state
 * holders (now on globalThis to survive per-file module re-eval).
 * ========================================================================== */

beforeEach(async () => {
  // TRUNCATE ... CASCADE wipes every entry table, modules_config, invites,
  // sessions and users in one round-trip and resets FK state. Much faster
  // than DROP + migrate between tests.
  //
  // `app_settings` has no user FK — it must be listed explicitly so
  // tests don't leak each other's `open_registration` toggles. Same
  // story for `email_verifications` rows that have a NULL `user_id`
  // (magic-link rows created before the user exists): those would not
  // be cascaded by the `users` truncate.
  await sql`
    TRUNCATE TABLE
      mood_entries,
      goals_entries,
      journal_entries,
      habits_items_entries,
      habits_logs_entries,
      library_items_entries,
      library_reviews_entries,
      review_entries,
      modules_config,
      user_preferences,
      announcements,
      password_reset_tokens,
      sessions,
      invites,
      app_settings,
      email_verifications,
      users
    RESTART IDENTITY CASCADE
  `;
  __resetRateLimits();
  __resetLoginStates();
  __resetOpaquePendingStates();
  __resetRecoverStates();
  __resetAlreadyExistsThrottle();
  __getRecordingEmailService().reset();
});

// Issue #41 bonus — leave the test DB clean at the end of a run, so
// `nodea_test` doesn't accumulate the last test file's fixtures
// between invocations. The `beforeEach` already isolates tests from
// each other; this `afterAll` is purely for hygiene when someone
// inspects `nodea_test` between runs.
afterAll(async () => {
  await sql`
    TRUNCATE TABLE
      mood_entries,
      goals_entries,
      journal_entries,
      habits_items_entries,
      habits_logs_entries,
      library_items_entries,
      library_reviews_entries,
      review_entries,
      modules_config,
      user_preferences,
      announcements,
      password_reset_tokens,
      sessions,
      invites,
      app_settings,
      email_verifications,
      users
    RESTART IDENTITY CASCADE
  `;
});

/* ============================================================================
 * OPAQUE-aware seeding — runs the real handshake in process so seeded
 * users can actually log in via /auth/login/start + /finish (Phase 2C+).
 *
 * Seeded users are OPAQUE-only — see `auth/seed-crypto.ts` for the
 * in-process registration round-trip. Tests for change-password,
 * change-email, delete-self exercise the OPAQUE proof path via
 * `loginAs` (which mints a full session and stamps the
 * `reauth_password_at` freshness window).
 * ========================================================================== */

interface SeedOpts {
  role?: 'user' | 'admin';
  password: string;
  username?: string;
}

async function seedOpaqueUser(
  email: string,
  opts: SeedOpts,
): Promise<{ id: string; email: string }> {
  const id = randomUUID();
  const userIdentifier = email.toLowerCase();

  const opaque = await opaqueRegister({
    userId: id,
    email: userIdentifier,
    password: opts.password,
  });

  await db.transaction(async (tx) => {
    await tx.insert(users).values({
      id,
      email: userIdentifier,
      username: opts.username ?? null,
      role: opts.role ?? 'user',
      wrappedMainKey: opaque.wrappedMainKey,
      wrappedMainKeyIv: opaque.wrappedMainKeyIv,
      wrappedKekPassword: opaque.wrappedKekPassword,
      wrappedKekPasswordIv: opaque.wrappedKekPasswordIv,
      emailVerifiedAt: new Date(),
      registerState: 'complete',
    });
    await tx.insert(opaqueRecords).values({
      userId: id,
      envelope: opaque.registrationRecord,
    });
  });

  return { id, email };
}

export async function seedAdmin(
  email = 'admin@example.com',
): Promise<{ id: string; email: string }> {
  return seedOpaqueUser(email, {
    role: 'admin',
    password: ADMIN_PASSWORD,
  });
}

export async function seedUser(
  email: string,
): Promise<{ id: string; email: string }> {
  return seedOpaqueUser(email, {
    role: 'user',
    password: TEST_PASSWORD,
  });
}

export async function seedInvite(
  email = 'invitee@example.com',
): Promise<{ id: string; token: string; email: string }> {
  const result = await createInvite({ email });
  return { id: result.id, token: result.token, email: result.email };
}

/* ============================================================================
 * Hono test app type (loose enough that any `buildApp()` instance fits)
 * ========================================================================== */

interface RequestableApp {
  request(input: string, init?: RequestInit): Response | Promise<Response>;
}

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/* ============================================================================
 * `loginAs` — drives /auth/login/start + /finish through the test
 * app and returns the resulting session cookie. Stamps a fresh
 * `reauth_password_at` on the session by virtue of going through
 * the real login finish.
 * ========================================================================== */

export async function loginAs(
  app: RequestableApp,
  email: string,
  password: string,
): Promise<string> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) {
    throw new Error(
      `loginAs: /auth/login/start failed (${startRes.status}: ${await startRes.text()})`,
    );
  }
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };

  const finished = client.finishLogin({
    password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('loginAs: client.finishLogin returned undefined (wrong password?)');
  }

  const finishRes = await app.request(
    '/auth/login/finish',
    jsonPost({ loginToken, finishLoginRequest: finished.finishLoginRequest }),
  );
  if (finishRes.status !== 200) {
    throw new Error(
      `loginAs: /auth/login/finish failed (${finishRes.status}: ${await finishRes.text()})`,
    );
  }

  const cookie = extractCookie(finishRes);
  if (!cookie) {
    throw new Error('loginAs: /auth/login/finish returned 200 but no session cookie');
  }
  return cookie;
}

/* ============================================================================
 * Pre-7B helper kept as a no-op data producer for backward compat.
 *
 * Mutating routes used to take an embedded `OpaquePasswordProof`
 * body and `passwordProofFor` returned exactly that shape. Phase 7B
 * moved the gate to a server-side `requireFreshPassword` middleware
 * keyed on `sessions.reauth_password_at`; the tokens this helper
 * produces are now silently stripped by zod (the `mode` /
 * `newEmail` schemas no longer declare them). The fields stay
 * harmlessly along for the ride.
 *
 * Tests that just want a fresh-password gate to pass should rely on
 * `loginAs` — which itself stamps `reauth_password_at` at finish.
 * Tests that want to explicitly exercise the re-auth path should
 * use {@link freshenReauth} below.
 */

export interface PasswordProofPayload {
  proofLoginToken: string;
  proofFinishLoginRequest: string;
}

export async function passwordProofFor(
  app: RequestableApp,
  email: string,
  password: string,
): Promise<PasswordProofPayload> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request(
    '/auth/login/start',
    jsonPost({ email, startLoginRequest }),
  );
  if (startRes.status !== 200) {
    throw new Error(
      `passwordProofFor: /auth/login/start failed (${startRes.status}: ${await startRes.text()})`,
    );
  }
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  const finished = client.finishLogin({
    password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('passwordProofFor: client.finishLogin returned undefined');
  }
  return {
    proofLoginToken: loginToken,
    proofFinishLoginRequest: finished.finishLoginRequest,
  };
}

/* ============================================================================
 * `freshenReauth` (Phase 7B) — runs the /auth/reauth/password OPAQUE
 * round-trip on the calling session cookie so the next mutating
 * action passes the `requireFreshPassword` middleware.
 *
 * Most tests don't need this at all — the cookie returned by
 * `loginAs` already lands a fresh `reauth_password_at` (login finish
 * stamps it). Use `freshenReauth` only when the test explicitly
 * wants to exercise the re-auth path (or when it backdated the
 * timestamp on purpose).
 * ========================================================================== */

export async function freshenReauth(
  app: RequestableApp,
  cookie: string,
  password: string,
): Promise<void> {
  await ready;
  const { clientLoginState, startLoginRequest } = client.startLogin({ password });
  const startRes = await app.request('/auth/reauth/password/start', {
    ...jsonPost({ startLoginRequest }),
    headers: { 'content-type': 'application/json', cookie },
  });
  if (startRes.status !== 200) {
    throw new Error(
      `freshenReauth: /auth/reauth/password/start failed (${startRes.status}: ${await startRes.text()})`,
    );
  }
  const { loginResponse, loginToken } = (await startRes.json()) as {
    loginResponse: string;
    loginToken: string;
  };
  const finished = client.finishLogin({
    password,
    clientLoginState,
    loginResponse,
  });
  if (!finished) {
    throw new Error('freshenReauth: client.finishLogin returned undefined');
  }
  const finishRes = await app.request('/auth/reauth/password/finish', {
    ...jsonPost({
      loginToken,
      finishLoginRequest: finished.finishLoginRequest,
    }),
    headers: { 'content-type': 'application/json', cookie },
  });
  if (finishRes.status !== 200) {
    throw new Error(
      `freshenReauth: /auth/reauth/password/finish failed (${finishRes.status}: ${await finishRes.text()})`,
    );
  }
}

/** Extract the session cookie from a Set-Cookie header, for chaining requests. */
export function extractCookie(res: Response): string | null {
  const header = res.headers.get('set-cookie');
  if (!header) return null;
  const match = header.match(/nodea_session=([^;]+)/);
  return match ? `nodea_session=${match[1]}` : null;
}

/* ============================================================================
 * Register helpers — drive the OPAQUE 2-step register flow against the
 * test app. Promoted from `auth-register-v2.test.ts` so the lifecycle
 * tests in `auth.test.ts` can reuse the same orchestration without
 * dynamic imports.
 *
 * Wrapped-key blobs are deterministic placeholders ; the server stores
 * them as opaque strings, the AAD bindings only matter at unwrap time.
 * ========================================================================== */

export interface StartedRegistration {
  clientRegistrationState: string;
  registrationResponse: string;
  userId: string;
  password: string;
}

/**
 * Default username derives from the email's local part so two distinct
 * emails in the same test don't trip the uniqueness check.
 */
export function defaultUsernameFor(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  const cleaned = local.replace(/[^\p{L}\p{N}_.-]/gu, '');
  return cleaned.length >= 2 ? cleaned : `${cleaned}_u`;
}

export async function startRegistration(
  app: RequestableApp,
  opts: { email: string; password: string; inviteToken?: string },
): Promise<{ res: Response; started?: StartedRegistration }> {
  await ready;
  const { clientRegistrationState, registrationRequest } = client.startRegistration({
    password: opts.password,
  });

  const body: Record<string, string> = {
    email: opts.email,
    registrationRequest,
  };
  if (opts.inviteToken) body.inviteToken = opts.inviteToken;

  const res = await app.request('/auth/register/start', jsonPost(body));
  if (res.status !== 200) return { res };

  const { registrationResponse, userId } = (await res.json()) as {
    registrationResponse: string;
    userId: string;
  };
  return {
    res,
    started: {
      clientRegistrationState,
      registrationResponse,
      userId,
      password: opts.password,
    },
  };
}

export async function finishRegistration(
  app: RequestableApp,
  opts: {
    email: string;
    username?: string;
    inviteToken?: string;
    started: StartedRegistration;
  },
): Promise<Response> {
  const { registrationRecord } = client.finishRegistration({
    password: opts.started.password,
    clientRegistrationState: opts.started.clientRegistrationState,
    registrationResponse: opts.started.registrationResponse,
  });

  const body: Record<string, string> = {
    email: opts.email,
    username: opts.username ?? defaultUsernameFor(opts.email),
    userId: opts.started.userId,
    registrationRecord,
    wrappedMainKey: 'test-wrapped-main-key',
    wrappedMainKeyIv: 'test-iv-main',
    wrappedKekPassword: 'test-wrapped-kek-password',
    wrappedKekPasswordIv: 'test-iv-kek',
  };
  if (opts.inviteToken) body.inviteToken = opts.inviteToken;

  return app.request('/auth/register/finish', jsonPost(body));
}

/**
 * Drive both register steps and return the /finish response. Throws
 * loud if /start failed — the test was probably mis-set-up.
 */
export async function fullRegister(
  app: RequestableApp,
  opts: {
    email: string;
    password: string;
    username?: string;
    inviteToken?: string;
  },
): Promise<Response> {
  const { res, started } = await startRegistration(app, opts);
  if (!started) {
    throw new Error(
      `fullRegister: /start failed with ${res.status} (${await res.text()})`,
    );
  }
  return finishRegistration(app, {
    email: opts.email,
    ...(opts.username !== undefined ? { username: opts.username } : {}),
    ...(opts.inviteToken !== undefined ? { inviteToken: opts.inviteToken } : {}),
    started,
  });
}
