import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import {
  OpaqueLoginFinishBodySchema,
  OpaqueLoginStartBodySchema,
  type OpaqueLoginFinishResponse,
  type OpaqueLoginStartResponse,
} from '@nodea/shared';

import {
  applyConsumableBypass,
  cancelPendingBypassesForUser,
} from '../auth/mfa-bypass.ts';
import { requiredFactorsForMode } from '../auth/mfa-policy.ts';
import {
  finishLogin as opaqueFinishLogin,
  opaqueReady,
  startLogin as opaqueStartLogin,
} from '../auth/opaque.ts';
import {
  consumeLoginState,
  storeLoginState,
} from '../auth/opaque-login-state.ts';
import {
  createSession,
  revokeSession,
} from '../auth/session.ts';
import {
  clearSessionCookie,
  setSessionCookie,
} from '../auth/cookies.ts';
import { db } from '../db/client.ts';
import { mfaTotp, opaqueRecords, users } from '../db/schema.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { renderMfaBypassAppliedEmail } from '../services/email/templates/mfa-bypass.ts';
import { getEmailService } from '../services/email/index.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';

import { loginLimiter } from './auth-shared.ts';

export const authLoginRoutes = new Hono<{ Variables: AuthVariables }>();

/**
 * OPAQUE login — step 1 (Auth-Roadmap Phase 2C).
 *
 * Public, rate-limited. Anti-enumeration is built into OPAQUE
 * itself : when the email doesn't match a record, we pass
 * `registrationRecord = null` to `server.startLogin` and the
 * lib produces a syntactically valid but cryptographically
 * dead response that fails at the client's `finishLogin` step.
 * The server response shape and timing are identical between
 * known and unknown identifiers — no dummy-hash trick needed.
 *
 * Server state for the protocol's second round-trip lives in
 * an in-memory map (`opaque-login-state.ts`) keyed by
 * `loginToken`. Single-use, 5-minute TTL.
 */
authLoginRoutes.post('/login/start', loginLimiter, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueLoginStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const userIdentifier = body.email.toLowerCase();

  // Load the registration record — null when the email is
  // unknown. The OPAQUE lib handles the null case opaquely
  // (anti-enum).
  const [record] = await db
    .select({ envelope: opaqueRecords.envelope })
    .from(opaqueRecords)
    .innerJoin(users, eq(opaqueRecords.userId, users.id))
    .where(eq(users.email, userIdentifier))
    .limit(1);

  let serverLoginState: string;
  let loginResponse: string;
  try {
    const result = opaqueStartLogin({
      userIdentifier,
      registrationRecord: record?.envelope ?? null,
      startLoginRequest: body.startLoginRequest,
    });
    serverLoginState = result.serverLoginState;
    loginResponse = result.loginResponse;
  } catch {
    // The first attempt threw — most commonly because the
    // stored `registrationRecord` is incompatible with the
    // current `OPAQUE_SERVER_SETUP` (envelope predates a
    // rotation). The original implementation returned 400
    // `invalid_body` here, which leaked the « known-but-stale
    // envelope » signal AND surfaced as a misleading error to
    // legit users. Anti-enum requires the response shape match
    // the unknown-email path, so we retry with
    // `registrationRecord: null` — same code path the lib runs
    // for a genuinely unknown identifier. The client's
    // `finishLogin` will reject the resulting blob and the UI
    // sees `invalid_credentials` at /finish, identical to a
    // wrong-password attempt.
    //
    // Only when this second pass also throws is the request
    // itself truly malformed (e.g. truncated base64,
    // non-curve-point in `startLoginRequest`). In that case we
    // fall back to 401 `invalid_credentials` — consistent with
    // /finish's failure shape, no anti-enum signal lost since
    // the client never gets a usable `loginToken`.
    try {
      const fallback = opaqueStartLogin({
        userIdentifier,
        registrationRecord: null,
        startLoginRequest: body.startLoginRequest,
      });
      serverLoginState = fallback.serverLoginState;
      loginResponse = fallback.loginResponse;
    } catch {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  }

  const loginToken = storeLoginState(serverLoginState, userIdentifier);

  const response: OpaqueLoginStartResponse = { loginResponse, loginToken };
  return c.json(response);
});

/**
 * OPAQUE login — step 2 (Auth-Roadmap Phase 2C).
 *
 * The client sends back its `finishLoginRequest`, computed
 * from the `loginResponse` it got at /start. The server
 * verifies the proof, looks up the user (via the identifier
 * captured at /start — the client can't swap identities
 * mid-protocol), runs the activation gate, then emits a
 * session cookie. No further auth factors in V1 ; Phase 4/5
 * branches into `mfa_pending` here.
 *
 * Failure modes all return `invalid_credentials` 401 with no
 * client-visible distinction between unknown user, wrong
 * password, expired token, and tampered finishLoginRequest —
 * anti-enum.
 */
authLoginRoutes.post('/login/finish', loginLimiter, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueLoginFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const pending = consumeLoginState(body.loginToken);
  if (!pending) return c.json({ error: 'invalid_credentials' }, 401);

  try {
    opaqueFinishLogin({
      serverLoginState: pending.state,
      finishLoginRequest: body.finishLoginRequest,
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Look up the user we agreed on at /start. The
  // userIdentifier was baked into `serverLoginState`, so by
  // the time finishLogin succeeded we know the password
  // matched THIS row — no risk of identifier confusion. If
  // the row vanished between /start and /finish (manual
  // delete, race with /admin), bail with the same generic
  // 401.
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, pending.userIdentifier))
    .limit(1);
  if (!user) return c.json({ error: 'invalid_credentials' }, 401);

  // Activation gate (Auth-Roadmap Phase 1 simplified) :
  // accounts created via the new register flow are inactive
  // until the user clicks the magic link in their activation
  // email.
  if (user.emailVerifiedAt === null) {
    return c.json({ error: 'account_not_activated' }, 403);
  }

  // MFA bypass lazy application (Auth-Roadmap Phase 6,
  // Auth-Spec §7.8). Before computing required factors,
  // consume any confirmed-past-48h bypass : it'll disable
  // TOTP / delete passkeys and may downgrade `security_mode`,
  // removing whichever factor the user can't produce
  // anymore. At most one bypass is active per user (unique
  // partial index), so the loop iterates at most once with a
  // side-effect.
  let activeUser = user;
  for (const f of ['totp', 'passkey'] as const) {
    const applied = await applyConsumableBypass(activeUser, f, null);
    if (applied) {
      const [refreshed] = await db
        .select()
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);
      if (refreshed) activeUser = refreshed;
      // Best-effort notification — login shouldn't fail if
      // SMTP hiccups. The user already saw the request email ;
      // this is just the « side-effect landed » follow-up.
      try {
        const rendered = renderMfaBypassAppliedEmail({
          language: extractEmailLanguage(c),
          factor: applied.factor,
          downgraded: applied.downgraded,
        });
        await getEmailService().send({
          to: activeUser.email,
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          tag: 'mfa-bypass-applied',
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
           
          console.warn('[auth/login] mfa-bypass-applied mail failed', err);
        }
      }
      break;
    }
  }

  // Stepped MFA gate (Auth-Roadmap Phase 5C, Auth-Spec §7.4) :
  // when the user's mode requires factors beyond password,
  // mint a `mfa_pending` session with
  // `mfa_password_verified=true` and return the wrap blobs
  // the client needs to unwrap the KEK + main key locally
  // (since `/auth/me` refuses pending sessions). The pending
  // row is promoted to `full` by `/auth/mfa/totp/verify` once
  // the remaining factors check out.
  //
  // We also gate on `mfa_totp.enabled_at` for the
  // `always_totp` / `maximum` modes — a corrupted state where
  // mode requires TOTP but the user has none enrolled would
  // otherwise lock them out. If TOTP isn't actually enrolled,
  // fall through to the full-session path (the user mode
  // will be downgraded by the next disable-TOTP / Settings
  // interaction).
  const baseRequired = requiredFactorsForMode(activeUser, 'password');
  let needsMfa = baseRequired.length > 0;
  if (needsMfa && baseRequired.includes('totp')) {
    const [totpRow] = await db
      .select({ enabledAt: mfaTotp.enabledAt })
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, user.id))
      .limit(1);
    if (!totpRow || totpRow.enabledAt === null) {
      // Mode demands TOTP but it's not actually enrolled —
      // emit full session as a safety net rather than lock
      // the user out permanently.
      needsMfa = false;
    }
  }

  if (
    !needsMfa ||
    user.wrappedMainKey === null ||
    user.wrappedMainKeyIv === null ||
    user.wrappedKekPassword === null ||
    user.wrappedKekPasswordIv === null
  ) {
    // Fall-through path : legacy / password_or_passkey /
    // safety net. A successful login proves the user
    // controls every required factor — defang any pending
    // bypass before issuing the session.
    await cancelPendingBypassesForUser(user.id);
    const session = await createSession(user.id, {
      reauthFresh: { password: true },
    });
    await setSessionCookie(c, session.id, session.expiresAt);
    const response: OpaqueLoginFinishResponse = {
      needsMfa: false,
      id: user.id,
    };
    return c.json(response);
  }

  // Stepped path : mfa_pending session with the primary
  // factor already marked verified.
  const pendingSession = await createSession(user.id, {
    kind: 'mfa_pending',
    mfaFlags: { mfaPasswordVerified: true },
  });
  await setSessionCookie(c, pendingSession.id, pendingSession.expiresAt);
  const response: OpaqueLoginFinishResponse = {
    needsMfa: true,
    id: user.id,
    factorsNeeded: baseRequired.filter(
      (f): f is 'totp' | 'passkey' => f !== 'password',
    ),
    wrappedMainKey: user.wrappedMainKey,
    wrappedMainKeyIv: user.wrappedMainKeyIv,
    wrappedKekPassword: user.wrappedKekPassword,
    wrappedKekPasswordIv: user.wrappedKekPasswordIv,
  };
  return c.json(response);
});

authLoginRoutes.post('/logout', requireUser, async (c) => {
  const sessionId = c.get('sessionId');
  await revokeSession(sessionId);
  clearSessionCookie(c);
  return c.json({ ok: true });
});
