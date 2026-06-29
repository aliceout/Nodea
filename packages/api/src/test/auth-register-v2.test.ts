/**
 * Integration tests for the OPAQUE 2-step register flow + the
 * activation magic-link route (Auth-Roadmap Phase 2B).
 *
 * Routes under test:
 *   - GET  /auth/register/mode
 *   - GET  /auth/register/invite-info?token=…
 *   - POST /auth/register/start             (OPAQUE step 1)
 *   - POST /auth/register/finish            (OPAQUE step 2 + persist)
 *   - POST /auth/register/activate          (open-path activation)
 *
 * Real Postgres + the in-memory `RecordingEmailService` (forced via
 * `vitest.config.ts`). OPAQUE handshake runs in-process via
 * `@serenity-kit/opaque` — there's no real client browser involved.
 */
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { client, ready } from '@serenity-kit/opaque';
import { buildApp } from '../app.ts';
import { db } from '../db/client.ts';
import {
  emailVerifications,
  invites,
  opaqueRecords,
  users,
} from '../db/schema.ts';
import { __getRecordingEmailService } from '../services/email/index.ts';
import { setOpenRegistration } from '../services/settings.ts';
import { hashToken } from '../auth/email-verifications.ts';
import { seedAdmin, seedInvite, seedUser } from './helpers.ts';

const app = buildApp();
const recording = __getRecordingEmailService();

const REG_PASSWORD = 'Brand-New-Test-Pass-99';

function jsonPost(body: unknown): RequestInit {
  return {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  };
}

/**
 * Default username derives from the email's local part so two
 * distinct emails in the same test don't trip the uniqueness check.
 */
function defaultUsernameFor(email: string): string {
  const local = email.split('@')[0] ?? 'user';
  const cleaned = local.replace(/[^\p{L}\p{N}_.-]/gu, '');
  return cleaned.length >= 2 ? cleaned : `${cleaned}_u`;
}

interface StartedRegistration {
  clientRegistrationState: string;
  registrationResponse: string;
  userId: string;
  password: string;
}

/**
 * Drive `POST /auth/register/start` from a fresh OPAQUE client
 * state. Returns a {@link StartedRegistration} that can be fed
 * straight into {@link finishRegistration} or used in negative-path
 * tests on /start alone.
 */
async function startRegistration(opts: {
  email: string;
  password?: string;
  inviteToken?: string;
}): Promise<{ res: Response; started?: StartedRegistration }> {
  await ready;
  const password = opts.password ?? REG_PASSWORD;
  const { clientRegistrationState, registrationRequest } =
    client.startRegistration({ password });

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
      password,
    },
  };
}

/**
 * Drive `POST /auth/register/finish` from a `StartedRegistration`.
 * The wrapped-key blobs are deterministic placeholders — the server
 * stores them as opaque strings, and Phase 2B doesn't check their
 * AAD bindings (those are validated at unwrap time, future Phase
 * 2C onwards).
 */
async function finishRegistration(opts: {
  email: string;
  username?: string;
  inviteToken?: string;
  started: StartedRegistration;
  /** Override the userId echoed back to /finish (tests negative
   *  paths where the client tampers with the value). */
  overrideUserId?: string;
}): Promise<Response> {
  const { registrationRecord } = client.finishRegistration({
    password: opts.started.password,
    clientRegistrationState: opts.started.clientRegistrationState,
    registrationResponse: opts.started.registrationResponse,
  });

  const body: Record<string, string> = {
    email: opts.email,
    username: opts.username ?? defaultUsernameFor(opts.email),
    userId: opts.overrideUserId ?? opts.started.userId,
    registrationRecord,
    wrappedMainKey: 'test-wrapped-main-key',
    wrappedMainKeyIv: 'test-iv-main',
    wrappedKekPassword: 'test-wrapped-kek-password',
    wrappedKekPasswordIv: 'test-iv-kek',
    // Recovery factor is mandatory at register now — placeholders + a valid
    // 64-hex hash (server stores the wrap blobs opaque).
    wrappedKekRecovery: 'test-wrapped-kek-recovery',
    wrappedKekRecoveryIv: 'test-iv-recovery',
    recoveryCodeHash: 'a'.repeat(64),
  };
  if (opts.inviteToken) body.inviteToken = opts.inviteToken;

  return app.request('/auth/register/finish', jsonPost(body));
}

/**
 * Convenience for the happy paths: drive both steps and return the
 * /finish response. Asserts /start succeeded — fail loud if it
 * didn't (the test was probably mis-set-up).
 */
async function fullRegister(opts: {
  email: string;
  username?: string;
  password?: string;
  inviteToken?: string;
}): Promise<Response> {
  const { res, started } = await startRegistration(opts);
  if (!started) {
    throw new Error(
      `fullRegister: /start failed with ${res.status} (${await res.text()})`,
    );
  }
  return finishRegistration({
    email: opts.email,
    ...(opts.username !== undefined ? { username: opts.username } : {}),
    ...(opts.inviteToken !== undefined ? { inviteToken: opts.inviteToken } : {}),
    started,
  });
}

function extractTokenFromLatestActivationMail(): string {
  const mail = recording.latestByTag('register-activate');
  if (!mail) throw new Error('no register-activate mail recorded');
  const match = mail.text.match(/token=([A-Za-z0-9_-]{16,})/);
  if (!match || !match[1]) {
    throw new Error(`no activation token in mail body:\n${mail.text}`);
  }
  return decodeURIComponent(match[1]);
}

/* ============================================================================
 * GET /auth/register/mode
 * ========================================================================== */

describe('GET /auth/register/mode', () => {
  it('reports open_registration false by default', async () => {
    const res = await app.request('/auth/register/mode');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ openRegistration: false });
  });

  it('reflects the admin toggle', async () => {
    const admin = await seedAdmin('mode-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const res = await app.request('/auth/register/mode');
    expect(await res.json()).toEqual({ openRegistration: true });
  });
});

/* ============================================================================
 * GET /auth/register/invite-info
 * ========================================================================== */

describe('GET /auth/register/invite-info', () => {
  it('returns the email a valid token was issued for', async () => {
    const invite = await seedInvite('target@example.com');
    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { email: string; expiresAt: string | null };
    expect(body.email).toBe('target@example.com');
    expect(body.expiresAt).toBeTruthy();
  });

  it('404s on an unknown token', async () => {
    const res = await app.request(
      '/auth/register/invite-info?token=totally-bogus-token-xxxxxxxxxxxxxxxxxx',
    );
    expect(res.status).toBe(404);
  });

  it('404s when the token is missing or too short', async () => {
    const res = await app.request('/auth/register/invite-info');
    expect(res.status).toBe(404);
  });

  it('404s after the invite has been consumed', async () => {
    const invite = await seedInvite('once-used@example.com');
    const finishRes = await fullRegister({
      email: 'once-used@example.com',
      inviteToken: invite.token,
    });
    expect(finishRes.status).toBe(200);

    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(404);
  });

  it('404s after the invite has expired', async () => {
    const invite = await seedInvite('expired-recipient@example.com');
    await db
      .update(invites)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(invites.id, invite.id));

    const res = await app.request(
      `/auth/register/invite-info?token=${encodeURIComponent(invite.token)}`,
    );
    expect(res.status).toBe(404);
  });
});

/* ============================================================================
 * POST /auth/register/start
 * ========================================================================== */

describe('POST /auth/register/start', () => {
  it('returns the OPAQUE response + a fresh userId on a valid invited start', async () => {
    const invite = await seedInvite('starter@example.com');
    const { res, started } = await startRegistration({
      email: 'starter@example.com',
      inviteToken: invite.token,
    });
    expect(res.status).toBe(200);
    expect(started?.registrationResponse).toBeTypeOf('string');
    expect(started?.userId).toMatch(/^[0-9a-f-]{36}$/);

    // /start must NOT consume the invite — that happens in /finish.
    const [stillUnused] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(stillUnused!.usedBy).toBeNull();
  });

  it('rejects 400 email_mismatch when the invite is for a different email', async () => {
    const invite = await seedInvite('intended@example.com');
    const { res } = await startRegistration({
      email: 'someone-else@example.com',
      inviteToken: invite.token,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'email_mismatch' });
  });

  it('rejects 401 invalid_token on an unknown invite', async () => {
    const { res } = await startRegistration({
      email: 'whoever@example.com',
      inviteToken: 'totally-bogus-token-xxxxxxxxxxxxxxxxxx',
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'invalid_token' });
  });

  it('returns 403 registration_closed when no token + open_registration off', async () => {
    const { res } = await startRegistration({ email: 'closed@example.com' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'registration_closed' });
  });

  it('rejects 400 invalid_body on a malformed registrationRequest', async () => {
    // Use the open path so /start gets past the registration_closed
    // gate and actually runs the OPAQUE call where the malformed
    // blob trips a parse error.
    const admin = await seedAdmin('malformed-admin@example.com');
    await setOpenRegistration(true, admin.id);
    await ready;

    const res = await app.request(
      '/auth/register/start',
      jsonPost({
        email: 'malformed@example.com',
        registrationRequest: 'not-a-real-opaque-blob',
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });
});

/* ============================================================================
 * POST /auth/register/finish — invited path
 * ========================================================================== */

describe('POST /auth/register/finish — invited path', () => {
  it('creates an activated user + opaque record and consumes the invite atomically', async () => {
    const invite = await seedInvite('newcomer@example.com');
    const res = await fullRegister({
      email: 'newcomer@example.com',
      inviteToken: invite.token,
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { activated: boolean; email: string };
    expect(body.activated).toBe(true);
    expect(body.email).toBe('newcomer@example.com');

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'newcomer@example.com'));
    expect(user).toBeDefined();
    expect(user!.emailVerifiedAt).not.toBeNull();
    expect(user!.username).toBe('newcomer');
    expect(user!.wrappedMainKey).toBe('test-wrapped-main-key');
    expect(user!.wrappedKekPassword).toBe('test-wrapped-kek-password');
    // Recovery factor created at signup (mandatory) — persisted + acknowledged.
    expect(user!.wrappedKekRecovery).toBe('test-wrapped-kek-recovery');
    expect(user!.recoveryCodeHash).toBe('a'.repeat(64));
    expect(user!.recoveryAcknowledgedAt).not.toBeNull();

    const [envelope] = await db
      .select()
      .from(opaqueRecords)
      .where(eq(opaqueRecords.userId, user!.id));
    expect(envelope).toBeDefined();
    expect(envelope!.envelope.length).toBeGreaterThan(0);

    const [usedInvite] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(usedInvite!.usedBy).toBe(user!.id);
    expect(usedInvite!.usedAt).not.toBeNull();

    // No activation email on the invited path.
    const activationMails = recording.sent.filter(
      (m) => m.tag === 'register-activate',
    );
    expect(activationMails).toHaveLength(0);
  });

  it('rejects 400 email_mismatch at /finish when client tampers with email after /start', async () => {
    const invite = await seedInvite('locked@example.com');
    const { started } = await startRegistration({
      email: 'locked@example.com',
      inviteToken: invite.token,
    });
    expect(started).toBeDefined();

    // Client lies on /finish about which email this invite is for.
    const res = await finishRegistration({
      email: 'attacker@example.com',
      inviteToken: invite.token,
      started: started!,
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ reason: 'email_mismatch' });

    // Invite stays unused.
    const [stillUnused] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(stillUnused!.usedBy).toBeNull();
  });

  it('rejects a re-used invite token with 401 invalid_token', async () => {
    const invite = await seedInvite('once@example.com');
    const first = await fullRegister({
      email: 'once@example.com',
      inviteToken: invite.token,
    });
    expect(first.status).toBe(200);

    // Second attempt with the same token: /start now reports invalid_token
    // because the invite is consumed.
    const { res } = await startRegistration({
      email: 'once@example.com',
      inviteToken: invite.token,
    });
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'invalid_token' });
  });

  /**
   * Closes Finding 2 of `docs/security-audit.md` — invite atomicity
   * under concurrent consumption.
   *
   * The implementation in `auth/invites.ts` wraps the consumption in
   * a `db.transaction(...)` with `SELECT … FOR UPDATE` so that two
   * parallel /finish requests on the same token can't both succeed.
   * That's a hard requirement per CLAUDE.md §Backend rules ; this
   * test is the integration filet that catches a regression if
   * someone removes the `.for('update')` later.
   *
   * Strategy : drive two `/start` calls in parallel (the invite isn't
   * consumed yet, both succeed and produce distinct `started` states),
   * then race two `/finish` calls. Postgres serialises the FOR UPDATE
   * lock — whichever transaction reaches it first inserts the user
   * and marks `usedBy` ; the loser sees the row as already-consumed
   * and returns 401.
   */
  it('rejects a second concurrent invite consumption (atomicity)', async () => {
    const invite = await seedInvite('race@example.com');

    const startA = startRegistration({
      email: 'race@example.com',
      inviteToken: invite.token,
    });
    const startB = startRegistration({
      email: 'race@example.com',
      inviteToken: invite.token,
    });
    const [a, b] = await Promise.all([startA, startB]);
    expect(a.started).toBeDefined();
    expect(b.started).toBeDefined();

    // Race the two /finish calls.
    const finishA = finishRegistration({
      email: 'race@example.com',
      inviteToken: invite.token,
      started: a.started!,
    });
    const finishB = finishRegistration({
      email: 'race@example.com',
      inviteToken: invite.token,
      started: b.started!,
    });
    const [resA, resB] = await Promise.all([finishA, finishB]);

    // Exactly one wins (200), the other gets 401 invalid_token (the
    // invite was consumed by the winner under FOR UPDATE) — or 400
    // email_taken if the loser slipped past the invite check but
    // hit the user-row uniqueness constraint. Both outcomes are
    // acceptable as long as exactly one user lands.
    const statuses = [resA.status, resB.status].sort((x, y) => x - y);
    expect(statuses[0]).toBe(200);
    expect([400, 401]).toContain(statuses[1]);

    // The invite must point to exactly one user, and exactly one
    // user row must exist for that email.
    const [usedInvite] = await db
      .select()
      .from(invites)
      .where(eq(invites.id, invite.id));
    expect(usedInvite!.usedBy).not.toBeNull();
    expect(usedInvite!.usedAt).not.toBeNull();

    const userRows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'race@example.com'));
    expect(userRows).toHaveLength(1);
  });
});

/* ============================================================================
 * POST /auth/register/finish — open path
 * ========================================================================== */

describe('POST /auth/register/finish — open path', () => {
  it('creates an inactive user + opaque record and emails an activation link', async () => {
    const admin = await seedAdmin('open-admin@example.com');
    await setOpenRegistration(true, admin.id);

    const res = await fullRegister({ email: 'open@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, activated: false });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'open@example.com'));
    expect(user).toBeDefined();
    expect(user!.emailVerifiedAt).toBeNull();
    expect(user!.wrappedMainKey).toBe('test-wrapped-main-key');

    const [envelope] = await db
      .select()
      .from(opaqueRecords)
      .where(eq(opaqueRecords.userId, user!.id));
    expect(envelope).toBeDefined();

    const verifs = await db
      .select()
      .from(emailVerifications)
      .where(eq(emailVerifications.email, 'open@example.com'));
    expect(verifs).toHaveLength(1);
    expect(verifs[0]!.consumedAt).toBeNull();

    expect(recording.latestByTag('register-activate')).toBeDefined();
  });

  it('returns 200 silently when the email already belongs to an active user', async () => {
    const admin = await seedAdmin('dup-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const existing = await seedUser('taken@example.com');
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing.id));

    const res = await fullRegister({ email: 'taken@example.com' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, activated: false });

    const activationMails = recording.sent.filter(
      (m) => m.tag === 'register-activate',
    );
    expect(activationMails).toHaveLength(0);

    // Dual-mail anti-enum (#45, Auth-Spec §7.1) : the submitter
    // sees the same silent 200 above, but the rightful owner of
    // the address gets an informational notice tagged
    // `register-already-exists`.
    const noticeMails = recording.sent.filter(
      (m) => m.tag === 'register-already-exists',
    );
    expect(noticeMails).toHaveLength(1);
    expect(noticeMails[0]!.to).toBe('taken@example.com');
  });

  it('throttles the already-exists notice to one mail per email per hour (#45)', async () => {
    const admin = await seedAdmin('throttle-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const existing = await seedUser('throttled@example.com');
    await db
      .update(users)
      .set({ emailVerifiedAt: new Date() })
      .where(eq(users.id, existing.id));

    // First attempt — the notice goes out.
    const first = await fullRegister({ email: 'throttled@example.com' });
    expect(first.status).toBe(200);
    const afterFirst = recording.sent.filter(
      (m) => m.tag === 'register-already-exists',
    ).length;
    expect(afterFirst).toBe(1);

    // Second attempt within the throttle window — same anti-enum
    // 200 from the submitter's point of view, but no extra notice
    // is sent (prevents the route from being a spam vector).
    const second = await fullRegister({ email: 'throttled@example.com' });
    expect(second.status).toBe(200);
    const afterSecond = recording.sent.filter(
      (m) => m.tag === 'register-already-exists',
    ).length;
    expect(afterSecond).toBe(1);
  });

  it('returns 200 silently on a second register attempt for an inactive email (no DB changes)', async () => {
    const admin = await seedAdmin('reuse-admin@example.com');
    await setOpenRegistration(true, admin.id);

    // First attempt creates the inactive user.
    const first = await fullRegister({ email: 'redo@example.com' });
    expect(first.status).toBe(200);

    const [originalUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'redo@example.com'));
    expect(originalUser).toBeDefined();

    const [originalEnvelope] = await db
      .select()
      .from(opaqueRecords)
      .where(eq(opaqueRecords.userId, originalUser!.id));
    expect(originalEnvelope).toBeDefined();

    // Second attempt — same email, fresh OPAQUE handshake. Server
    // returns silent 200 and does NOT replace the existing envelope
    // (its AAD bindings would diverge from the new userId issued
    // at /start).
    const second = await fullRegister({ email: 'redo@example.com' });
    expect(second.status).toBe(200);

    const userRows = await db
      .select()
      .from(users)
      .where(eq(users.email, 'redo@example.com'));
    expect(userRows).toHaveLength(1);
    expect(userRows[0]!.id).toBe(originalUser!.id);

    const envelopes = await db
      .select()
      .from(opaqueRecords)
      .where(eq(opaqueRecords.userId, originalUser!.id));
    expect(envelopes).toHaveLength(1);
    expect(envelopes[0]!.envelope).toBe(originalEnvelope!.envelope);

    // Dual-mail anti-enum (#45) on the inactive branch too : the
    // first register sent the activation mail ; the second hits
    // `if (existing)` and emits a single `register-already-exists`
    // notice (same logic as the active-email case, validated
    // separately in « already belongs to an active user »).
    const noticeMails = recording.sent.filter(
      (m) => m.tag === 'register-already-exists',
    );
    expect(noticeMails).toHaveLength(1);
    expect(noticeMails[0]!.to).toBe('redo@example.com');
  });
});

/* ============================================================================
 * POST /auth/register/finish — username field
 * ========================================================================== */

describe('POST /auth/register/finish — username field', () => {
  it('rejects 400 invalid_body when username is missing at /finish', async () => {
    const invite = await seedInvite('no-username@example.com');
    const { started } = await startRegistration({
      email: 'no-username@example.com',
      inviteToken: invite.token,
    });
    expect(started).toBeDefined();

    const { registrationRecord } = client.finishRegistration({
      password: REG_PASSWORD,
      clientRegistrationState: started!.clientRegistrationState,
      registrationResponse: started!.registrationResponse,
    });

    // Send the finish body WITHOUT the username field.
    const res = await app.request(
      '/auth/register/finish',
      jsonPost({
        email: 'no-username@example.com',
        userId: started!.userId,
        registrationRecord,
        wrappedMainKey: 'x',
        wrappedMainKeyIv: 'x',
        wrappedKekPassword: 'x',
        wrappedKekPasswordIv: 'x',
        // Recovery blobs present so the ONLY missing field is `username`.
        wrappedKekRecovery: 'x',
        wrappedKekRecoveryIv: 'x',
        recoveryCodeHash: 'a'.repeat(64),
        inviteToken: invite.token,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });

  it('rejects 400 invalid_body when username has invalid characters', async () => {
    const invite = await seedInvite('bad-chars@example.com');
    const res = await fullRegister({
      email: 'bad-chars@example.com',
      inviteToken: invite.token,
      username: 'has spaces!',
    });
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });

  it('allows duplicate usernames on the invited path (display name only)', async () => {
    const seeded = await seedUser('first@example.com');
    await db.update(users).set({ username: 'Pseudo' }).where(eq(users.id, seeded.id));

    const invite = await seedInvite('clasher@example.com');
    const res = await fullRegister({
      email: 'clasher@example.com',
      inviteToken: invite.token,
      username: 'Pseudo',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, activated: true });

    // Both rows now share the username "Pseudo" — that's fine, the
    // identifier is `users.id` (and `email` for login).
    const dupes = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'Pseudo'));
    expect(dupes).toHaveLength(2);
  });

  it('allows duplicate usernames on the open path', async () => {
    const admin = await seedAdmin('uname-open-admin@example.com');
    await setOpenRegistration(true, admin.id);
    const seeded = await seedUser('squatter@example.com');
    await db.update(users).set({ username: 'OpenName' }).where(eq(users.id, seeded.id));

    const res = await fullRegister({
      email: 'wants-it@example.com',
      username: 'OpenName',
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, activated: false });

    const dupes = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.username, 'OpenName'));
    expect(dupes).toHaveLength(2);
  });
});

/* ============================================================================
 * POST /auth/register/finish — recovery factor (mandatory at signup)
 * ========================================================================== */

describe('POST /auth/register/finish — recovery factor', () => {
  it('rejects 400 invalid_body when the recovery blobs are missing', async () => {
    const invite = await seedInvite('no-recovery@example.com');
    const { started } = await startRegistration({
      email: 'no-recovery@example.com',
      inviteToken: invite.token,
    });
    expect(started).toBeDefined();

    const { registrationRecord } = client.finishRegistration({
      password: REG_PASSWORD,
      clientRegistrationState: started!.clientRegistrationState,
      registrationResponse: started!.registrationResponse,
    });

    // Finish body WITHOUT the (now-mandatory) recovery blobs.
    const res = await app.request(
      '/auth/register/finish',
      jsonPost({
        email: 'no-recovery@example.com',
        username: 'norecovery',
        userId: started!.userId,
        registrationRecord,
        wrappedMainKey: 'x',
        wrappedMainKeyIv: 'x',
        wrappedKekPassword: 'x',
        wrappedKekPasswordIv: 'x',
        inviteToken: invite.token,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });

    // No account was created — the invite stays unused.
    const rows = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, 'no-recovery@example.com'));
    expect(rows).toHaveLength(0);
  });

  it('rejects 400 invalid_body on a malformed recoveryCodeHash', async () => {
    const invite = await seedInvite('bad-hash@example.com');
    const { started } = await startRegistration({
      email: 'bad-hash@example.com',
      inviteToken: invite.token,
    });
    expect(started).toBeDefined();

    const { registrationRecord } = client.finishRegistration({
      password: REG_PASSWORD,
      clientRegistrationState: started!.clientRegistrationState,
      registrationResponse: started!.registrationResponse,
    });

    const res = await app.request(
      '/auth/register/finish',
      jsonPost({
        email: 'bad-hash@example.com',
        username: 'badhash',
        userId: started!.userId,
        registrationRecord,
        wrappedMainKey: 'x',
        wrappedMainKeyIv: 'x',
        wrappedKekPassword: 'x',
        wrappedKekPasswordIv: 'x',
        wrappedKekRecovery: 'x',
        wrappedKekRecoveryIv: 'x',
        // Not 64 lowercase-hex chars → fails the Sha256Hex regex.
        recoveryCodeHash: 'not-a-valid-hash',
        inviteToken: invite.token,
      }),
    );
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: 'invalid_body' });
  });
});

/* ============================================================================
 * POST /auth/register/activate
 * ========================================================================== */

describe('POST /auth/register/activate', () => {
  async function openSubmit(email: string): Promise<string> {
    const admin = await seedAdmin(`act-admin-${Date.now()}@example.com`);
    await setOpenRegistration(true, admin.id);
    await fullRegister({ email });
    return extractTokenFromLatestActivationMail();
  }

  it('flips email_verified_at on a fresh token + reports the email back', async () => {
    const token = await openSubmit('activate-me@example.com');
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      ok: true,
      email: 'activate-me@example.com',
    });

    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, 'activate-me@example.com'));
    expect(user!.emailVerifiedAt).not.toBeNull();
  });

  it('rejects a malformed body with 400 invalid_body', async () => {
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token: 'too-short' }),
    );
    expect(res.status).toBe(400);
  });

  it('rejects a re-used token with 401 already_consumed', async () => {
    const token = await openSubmit('replay@example.com');
    await app.request('/auth/register/activate', jsonPost({ token }));
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'already_consumed' });
  });

  it('rejects an expired token with 410 expired', async () => {
    const token = await openSubmit('stale@example.com');
    // Backdate the verification row.
    await db
      .update(emailVerifications)
      .set({ expiresAt: new Date(Date.now() - 60_000) })
      .where(eq(emailVerifications.codeHash, hashToken(token)));
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token }),
    );
    expect(res.status).toBe(410);
    expect(await res.json()).toMatchObject({ reason: 'expired' });
  });

  it('rejects an unknown token with 401 invalid_token', async () => {
    const res = await app.request(
      '/auth/register/activate',
      jsonPost({ token: 'unknown-token-aaaaaaaaaaaaaaaaaaaaaa' }),
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({ reason: 'invalid_token' });
  });
});

// The login activation gate (`account_not_activated` 403) is covered
// in `auth-login-v2.test.ts` now that login is the OPAQUE 2-step flow.
