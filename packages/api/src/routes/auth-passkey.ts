import { Hono } from 'hono';
import { and, eq } from 'drizzle-orm';
import { randomBytes, randomUUID } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import {
  PasskeyDeleteBodySchema,
  PasskeyEnrollFinishBodySchema,
  PasskeyEnrollStartBodySchema,
  PasskeyLoginFinishBodySchema,
  PasskeyLoginStartBodySchema,
  PasskeyRenameWithProofBodySchema,
  type PasskeyEnrollFinishResponse,
  type PasskeyEnrollStartResponse,
  type PasskeyListItem,
  type PasskeyListResponse,
  type PasskeyLoginFinishResponse,
  type PasskeyLoginStartResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, sessions, users } from '../db/schema.ts';
import { requiredFactorsForMode } from '../auth/mfa-policy.ts';
import {
  applyConsumableBypass,
  cancelPendingBypassesForUser,
} from '../auth/mfa-bypass.ts';
import { renderMfaBypassAppliedEmail } from '../services/email/templates/mfa-bypass.ts';
import { renderSecurityModeDowngradedEmail } from '../services/email/templates/security-mode-downgraded.ts';
import { getEmailService } from '../services/email/index.ts';
import {
  consumePasskeyLoginPending,
  storePasskeyLoginPending,
} from '../auth/passkey-login-state.ts';
import { createSession } from '../auth/session.ts';
import { setSessionCookie } from '../auth/cookies.ts';
import { getConfig } from '../config.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';

/**
 * Passkey routes (Auth-Roadmap Phase 4, Auth-Spec §7.3 + §9).
 *
 * Five authenticated routes (`requireUser`) for enrollment / list /
 * rename / remove, plus two anonymous routes for the passkey-first
 * login flow:
 *
 *   - `POST /auth/passkey/enroll/start`   (auth, password proof)
 *   - `POST /auth/passkey/enroll/finish`  (auth)
 *   - `GET  /auth/passkey/list`           (auth)
 *   - `PATCH /auth/passkey/:id/label`     (auth, password proof)
 *   - `POST /auth/passkey/:id/remove`     (auth, password proof)
 *   - `POST /auth/passkey/login/start`    (anon)
 *   - `POST /auth/passkey/login/finish`   (anon)
 *
 * Server-side WebAuthn primitives come from `@simplewebauthn/server`.
 * Challenges are persisted on the `sessions` row for enrollment
 * (`pending_webauthn_challenge`, TTL 5 min) and on a single-use
 * pending entry for login (`passkey-login-state.ts`).
 *
 * UV is `'required'` everywhere — Auth-Spec §9.3 prescribes refusing
 * any authenticator without gesture (no PIN, no biometric). The
 * browser refuses non-UV authenticators at enrollment; the server
 * also enforces `userVerified === true` at /finish so a tampered
 * client can't bypass.
 */
export const authPasskeyRoutes = new Hono<{ Variables: AuthVariables }>();

/* ============================================================================
 * Rate limits
 * ========================================================================== */

const enrollLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-enroll',
});

const loginLimiter = rateLimit({
  max: 20,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-login',
});

const manageLimiter = rateLimit({
  max: 30,
  windowMs: 15 * 60_000,
  keyPrefix: 'passkey-manage',
});

/* ============================================================================
 * Helper: build the WebAuthn user handle from our user id
 * ========================================================================== */

/**
 * `userID` for `generateRegistrationOptions` must be a
 * `Uint8Array<ArrayBuffer>` (the lib's `Uint8Array_` alias narrows
 * to `ArrayBuffer`, not `ArrayBufferLike`). We allocate a fresh
 * `ArrayBuffer`, view it with `Uint8Array`, and let TS infer the
 * narrowed return type — declaring `: Uint8Array` would widen it
 * back to `<ArrayBufferLike>`.
 */
function userIdToHandle(userId: string) {
  // UTF-8 of a UUID string is the same byte length as the string
  // (ASCII), so `userId.length` is a safe pre-allocation.
  const buf = new ArrayBuffer(userId.length);
  const view = new Uint8Array(buf);
  new TextEncoder().encodeInto(userId, view);
  return view;
}

/* ============================================================================
 * POST /auth/passkey/enroll/start
 * ========================================================================== */

authPasskeyRoutes.post(
  '/passkey/enroll/start',
  requireUser,
  requireFreshPassword,
  enrollLimiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = PasskeyEnrollStartBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

    const user = c.get('user');

    // Pull the user's existing passkey credential ids so the browser
    // refuses to enroll the same authenticator twice. Anti-double-
    // enrollment is a UX-only concern — duplicate enrollments would
    // produce an `auth_factors_credential_id_unique` collision at
    // /finish anyway, but failing in the browser is friendlier.
    const existing = await db
      .select({ credentialId: authFactors.credentialId, transports: authFactors.transports })
      .from(authFactors)
      .where(eq(authFactors.userId, user.id));

    const config = getConfig();
    const creationOptions = await generateRegistrationOptions({
      rpName: config.WEBAUTHN_RP_NAME,
      rpID: config.WEBAUTHN_RP_ID,
      userName: user.email,
      userDisplayName: user.username ?? user.email,
      userID: userIdToHandle(user.id),
      attestationType: 'none',
      authenticatorSelection: {
        userVerification: 'required',
        residentKey: 'preferred',
      },
      excludeCredentials: existing.map((row) => {
        const transports = parseTransports(row.transports);
        // exactOptionalPropertyTypes: only include the `transports`
        // key when we actually have one. Spreading a conditional
        // object keeps the shape strictly { id } | { id, transports }.
        return transports !== undefined
          ? { id: row.credentialId, transports }
          : { id: row.credentialId };
      }),
      // PRF extension — `eval` carries our fixed 32-byte input so the
      // PRF output is deterministic for a given (credential, input)
      // pair across logins. Enrollment doesn't use the output yet
      // (the client wraps the KEK at /finish, after `prfOutput`
      // surfaces); we still pass it so the authenticator picks up
      // the extension request.
      extensions: { prf: {} } as unknown as AuthenticationExtensionsClientInputsLike,
    });

    // Persist the challenge on the session row. `pending_webauthn_*`
    // columns exist on `sessions` precisely for this. Single-instance
    // assumption: the session ID identifies one Hono process, so the
    // /finish call lands in the same memory.
    const sessionId = c.get('sessionId');
    await db
      .update(sessions)
      .set({
        pendingWebauthnChallenge: creationOptions.challenge,
        pendingWebauthnChallengeAt: new Date(),
      })
      .where(eq(sessions.id, sessionId));

    const response: PasskeyEnrollStartResponse = {
      creationOptions: creationOptions as unknown as Record<string, unknown>,
    };
    return c.json(response);
  },
);

/* ============================================================================
 * POST /auth/passkey/enroll/finish
 * ========================================================================== */

authPasskeyRoutes.post(
  '/passkey/enroll/finish',
  requireUser,
  enrollLimiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = PasskeyEnrollFinishBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;
    const user = c.get('user');
    const sessionId = c.get('sessionId');

    // Refuse early if the wrap blob shape is incoherent with the
    // PRF flag. `prfSupported = true` ⇒ both blobs non-null.
    // `prfSupported = false` ⇒ both blobs null.
    if (
      (body.prfSupported && (body.wrappedKek === null || body.wrappedKekIv === null)) ||
      (!body.prfSupported && (body.wrappedKek !== null || body.wrappedKekIv !== null))
    ) {
      return c.json({ error: 'invalid_body' }, 400);
    }

    const [session] = await db
      .select({
        challenge: sessions.pendingWebauthnChallenge,
        challengeAt: sessions.pendingWebauthnChallengeAt,
      })
      .from(sessions)
      .where(eq(sessions.id, sessionId))
      .limit(1);

    if (!session?.challenge || !session.challengeAt) {
      return c.json({ error: 'no_pending_challenge' }, 400);
    }
    // 5-min TTL on the challenge (Auth-Spec §9.2).
    if (Date.now() - session.challengeAt.getTime() > 5 * 60_000) {
      return c.json({ error: 'challenge_expired' }, 400);
    }

    const config = getConfig();
    let verification: Awaited<ReturnType<typeof verifyRegistrationResponse>>;
    try {
      verification = await verifyRegistrationResponse({
        response: body.attestationResponse as unknown as RegistrationResponseJSON,
        expectedChallenge: session.challenge,
        expectedOrigin: config.WEBAUTHN_ORIGIN,
        expectedRPID: config.WEBAUTHN_RP_ID,
        requireUserVerification: true,
      });
    } catch {
      return c.json({ error: 'verification_failed' }, 400);
    }

    if (!verification.verified || !verification.registrationInfo) {
      return c.json({ error: 'verification_failed' }, 400);
    }

    const { credential, userVerified } = verification.registrationInfo;
    if (!userVerified) {
      // Defence-in-depth: `requireUserVerification: true` should have
      // already rejected, but spec compliance demands the server
      // double-check the flag (Auth-Spec §9.3).
      return c.json({ error: 'user_verification_required' }, 400);
    }

    // Encode public key + credential id to base64url for storage.
    // Both are `Uint8Array_` from the lib — we keep them as base64url
    // so DB lookups + AAD building (passkey AAD uses the credential
    // id verbatim) can stay string-typed end-to-end.
    const credentialIdB64Url = credential.id;
    const publicKeyB64Url = bytesToBase64Url(credential.publicKey);

    const id = randomUUID();
    try {
      await db.insert(authFactors).values({
        id,
        userId: user.id,
        kind: 'passkey',
        credentialId: credentialIdB64Url,
        publicKey: publicKeyB64Url,
        signCount: credential.counter,
        signCountStrict: true,
        transports: body.transports,
        prfSupported: body.prfSupported,
        wrappedKek: body.wrappedKek,
        wrappedKekIv: body.wrappedKekIv,
        label: body.label,
      });
    } catch (err) {
      if (isUniqueViolation(err, 'auth_factors_credential_id_unique')) {
        return c.json({ error: 'already_enrolled' }, 409);
      }
      throw err;
    }

    // Clear the challenge — single-use.
    await db
      .update(sessions)
      .set({
        pendingWebauthnChallenge: null,
        pendingWebauthnChallengeAt: null,
      })
      .where(eq(sessions.id, sessionId));

    const response: PasskeyEnrollFinishResponse = {
      id,
      prfSupported: body.prfSupported,
    };
    return c.json(response);
  },
);

/* ============================================================================
 * GET /auth/passkey/list
 * ========================================================================== */

authPasskeyRoutes.get('/passkey/list', requireUser, manageLimiter, async (c) => {
  const user = c.get('user');
  const rows = await db
    .select({
      id: authFactors.id,
      label: authFactors.label,
      prfSupported: authFactors.prfSupported,
      transports: authFactors.transports,
      createdAt: authFactors.createdAt,
      lastUsedAt: authFactors.lastUsedAt,
    })
    .from(authFactors)
    .where(eq(authFactors.userId, user.id));

  const passkeys: PasskeyListItem[] = rows.map((row) => ({
    id: row.id,
    label: row.label,
    prfSupported: row.prfSupported,
    transports: row.transports,
    createdAt: row.createdAt.toISOString(),
    lastUsedAt: row.lastUsedAt ? row.lastUsedAt.toISOString() : null,
  }));
  const prfCount = passkeys.filter((p) => p.prfSupported).length;

  const response: PasskeyListResponse = { passkeys, prfCount };
  return c.json(response);
});

/* ============================================================================
 * PATCH /auth/passkey/:id/label
 * ========================================================================== */

authPasskeyRoutes.patch(
  '/passkey/:id/label',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
    const id = c.req.param('id');
    const raw = await c.req.json().catch(() => null);
    const parsed = PasskeyRenameWithProofBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;
    const user = c.get('user');

    const result = await db
      .update(authFactors)
      .set({ label: body.label })
      .where(and(eq(authFactors.id, id), eq(authFactors.userId, user.id)))
      .returning({ id: authFactors.id });

    if (result.length === 0) return c.json({ error: 'not_found' }, 404);
    return c.json({ ok: true });
  },
);

/* ============================================================================
 * POST /auth/passkey/:id/remove
 * ========================================================================== */

authPasskeyRoutes.post(
  '/passkey/:id/remove',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
    const id = c.req.param('id');
    const raw = await c.req.json().catch(() => null);
    const parsed = PasskeyDeleteBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const user = c.get('user');

    const result = await db
      .delete(authFactors)
      .where(and(eq(authFactors.id, id), eq(authFactors.userId, user.id)))
      .returning({
        id: authFactors.id,
        prfSupported: authFactors.prfSupported,
      });

    if (result.length === 0) return c.json({ error: 'not_found' }, 404);

    // §6.1 downgrade auto: if the deletion took the last PRF-capable
    // passkey AND the user is in `maximum`, fall back to
    // `password_or_passkey`. Only applies when the deleted credential
    // was PRF-capable — non-PRF removals never trigger downgrade.
    if (result[0]?.prfSupported && user.securityMode === 'maximum') {
      const remaining = await db
        .select({ id: authFactors.id })
        .from(authFactors)
        .where(
          and(
            eq(authFactors.userId, user.id),
            eq(authFactors.prfSupported, true),
          ),
        )
        .limit(1);
      if (remaining.length === 0) {
        await db
          .update(users)
          .set({ securityMode: 'password_or_passkey', updatedAt: new Date() })
          .where(eq(users.id, user.id));
        // Best-effort notification — the downgrade is already
        // committed; an SMTP hiccup must not flip the route to
        // 5xx. Mode `'maximum'` is the only path that reaches
        // here (the `if` above gates on it).
        try {
          const rendered = renderSecurityModeDowngradedEmail({
            trigger: 'last_prf_passkey_removed',
            previousMode: 'maximum',
          });
          await getEmailService().send({
            to: user.email,
            subject: rendered.subject,
            text: rendered.text,
            html: rendered.html,
            tag: 'security-mode-downgraded',
          });
        } catch (err) {
          if (process.env.NODE_ENV !== 'production') {
            // eslint-disable-next-line no-console
            console.warn(
              '[auth/passkey] downgrade notification mail failed',
              err,
            );
          }
        }
      }
    }

    return c.json({ ok: true });
  },
);

/* ============================================================================
 * POST /auth/passkey/login/start (anonymous)
 * ========================================================================== */

authPasskeyRoutes.post('/passkey/login/start', loginLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyLoginStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const config = getConfig();

  let userId: string | null = null;
  let allowCredentials: { id: string; transports?: AuthenticatorTransportFuture[] }[] | undefined;

  if (body.email) {
    const email = body.email.toLowerCase();
    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // Anti-enum: if the email is unknown we still produce options
    // (with a generic challenge + no allowCredentials). The client
    // prompt then fails ("no credential available") indistinguishably
    // from "wrong email" + "no passkey enrolled".
    if (user) {
      userId = user.id;
      const rows = await db
        .select({
          credentialId: authFactors.credentialId,
          transports: authFactors.transports,
        })
        .from(authFactors)
        .where(eq(authFactors.userId, user.id));
      allowCredentials = rows.map((row) => {
        const transports = parseTransports(row.transports);
        return transports !== undefined
          ? { id: row.credentialId, transports }
          : { id: row.credentialId };
      });
    }
  }

  const requestOptions = await generateAuthenticationOptions({
    rpID: config.WEBAUTHN_RP_ID,
    userVerification: 'required',
    ...(allowCredentials !== undefined ? { allowCredentials } : {}),
    extensions: { prf: {} } as unknown as AuthenticationExtensionsClientInputsLike,
  });

  const loginToken = storePasskeyLoginPending(requestOptions.challenge, userId);

  const response: PasskeyLoginStartResponse = {
    requestOptions: requestOptions as unknown as Record<string, unknown>,
    loginToken,
  };
  return c.json(response);
});

/* ============================================================================
 * POST /auth/passkey/login/finish (anonymous)
 * ========================================================================== */

authPasskeyRoutes.post('/passkey/login/finish', loginLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyLoginFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;

  const pending = consumePasskeyLoginPending(body.loginToken);
  if (!pending) return c.json({ error: 'invalid_credentials' }, 401);

  const assertion = body.assertionResponse as unknown as AuthenticationResponseJSON;
  const assertionId = assertion.id;
  if (typeof assertionId !== 'string' || assertionId.length === 0) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Look up the credential the assertion claims. For email-bound
  // starts we also enforce `userId` match — protects against a
  // crafted assertion from another user's credential.
  const [factor] = await db
    .select()
    .from(authFactors)
    .where(eq(authFactors.credentialId, assertionId))
    .limit(1);
  if (!factor) return c.json({ error: 'invalid_credentials' }, 401);
  if (pending.userId !== null && factor.userId !== pending.userId) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const config = getConfig();
  const transports = parseTransports(factor.transports);
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: pending.challenge,
      expectedOrigin: config.WEBAUTHN_ORIGIN,
      expectedRPID: config.WEBAUTHN_RP_ID,
      requireUserVerification: true,
      credential: {
        id: factor.credentialId,
        publicKey: base64UrlToBytes(factor.publicKey),
        counter: factor.signCount,
        // exactOptionalPropertyTypes: only spread when defined.
        ...(transports !== undefined ? { transports } : {}),
      },
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Sign-counter handling (Auth-Spec §9.6). When `signCountStrict`
  // is true, refuse `newCounter <= signCount`. When the authenticator
  // returns 0, Apple-style — flip strict off after 3 consecutive 0s.
  // We approximate "3 consecutive" by a simpler heuristic:
  // any-time-we-see-0-twice-in-a-row → flip. The downside is one
  // extra valid assertion before the strict check is dropped; the
  // upside is no extra column.
  const newCounter = verification.authenticationInfo.newCounter;
  if (factor.signCountStrict) {
    if (newCounter > 0 && newCounter <= factor.signCount) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  }

  // Load the wrapped main key + the user's security_mode so we can
  // decide whether to emit a `full` session or step into MFA.
  const [account] = await db
    .select({
      id: users.id,
      wrappedMainKey: users.wrappedMainKey,
      wrappedMainKeyIv: users.wrappedMainKeyIv,
      securityMode: users.securityMode,
    })
    .from(users)
    .where(eq(users.id, factor.userId))
    .limit(1);
  if (
    !account ||
    account.wrappedMainKey === null ||
    account.wrappedMainKeyIv === null
  ) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Bump counter + last_used_at + maybe flip strict. Single statement
  // — passkey login is on the hot path of every session start.
  const nextStrict =
    factor.signCountStrict && newCounter === 0 && factor.signCount === 0
      ? false
      : factor.signCountStrict;
  await db
    .update(authFactors)
    .set({
      signCount: newCounter,
      signCountStrict: nextStrict,
      lastUsedAt: new Date(),
    })
    .where(eq(authFactors.id, factor.id));

  // MFA bypass lazy application (Auth-Roadmap Phase 6, Auth-Spec
  // §7.8). Same logic as the OPAQUE login flow: consume any
  // confirmed-past-48h bypass before computing required factors.
  let activeMode = account.securityMode;
  for (const f of ['totp', 'passkey'] as const) {
    const applied = await applyConsumableBypass(
      { id: account.id, securityMode: activeMode },
      f,
      null,
    );
    if (applied) {
      const [refreshed] = await db
        .select({ securityMode: users.securityMode, email: users.email })
        .from(users)
        .where(eq(users.id, account.id))
        .limit(1);
      if (refreshed) activeMode = refreshed.securityMode;
      try {
        const rendered = renderMfaBypassAppliedEmail({
          factor: applied.factor,
          downgraded: applied.downgraded,
        });
        await getEmailService().send({
          to: refreshed?.email ?? '',
          subject: rendered.subject,
          text: rendered.text,
          html: rendered.html,
          tag: 'mfa-bypass-applied',
        });
      } catch (err) {
        if (process.env.NODE_ENV !== 'production') {
          // eslint-disable-next-line no-console
          console.warn('[auth/passkey] mfa-bypass-applied mail failed', err);
        }
      }
      break;
    }
  }

  // Stepped MFA gate (Auth-Roadmap Phase 5C, Auth-Spec §7.4): same
  // logic as the password-first path but with `entryFactor=passkey`.
  // Mode `maximum` is the case where the passkey-first user still
  // needs password + TOTP; mode `always_totp` just needs TOTP.
  const baseRequired = requiredFactorsForMode(
    { securityMode: activeMode },
    'passkey',
  );
  let needsMfa = baseRequired.length > 0;
  if (needsMfa && baseRequired.includes('totp')) {
    const [totpRow] = await db
      .select({ enabledAt: mfaTotp.enabledAt })
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, account.id))
      .limit(1);
    if (!totpRow || totpRow.enabledAt === null) {
      // Same safety net as the password path: don't lock the user
      // out if mode requires TOTP but it's not enrolled.
      needsMfa = false;
    }
  }

  if (needsMfa) {
    const pendingSession = await createSession(account.id, {
      kind: 'mfa_pending',
      mfaFlags: { mfaPasskeyVerified: true },
    });
    await setSessionCookie(c, pendingSession.id, pendingSession.expiresAt);
    const response: PasskeyLoginFinishResponse = {
      userId: account.id,
      credentialId: factor.credentialId,
      prfSupported: factor.prfSupported,
      wrappedKek: factor.wrappedKek,
      wrappedKekIv: factor.wrappedKekIv,
      wrappedMainKey: account.wrappedMainKey,
      wrappedMainKeyIv: account.wrappedMainKeyIv,
      needsMfa: true,
      factorsNeeded: [...baseRequired],
    };
    return c.json(response);
  }

  // Successful passkey-only login: defang any pending bypass before
  // minting the full session — see auth.ts for rationale.
  await cancelPendingBypassesForUser(account.id);
  const session = await createSession(account.id, {
    reauthFresh: { passkey: true },
  });
  await setSessionCookie(c, session.id, session.expiresAt);

  const response: PasskeyLoginFinishResponse = {
    userId: account.id,
    credentialId: factor.credentialId,
    prfSupported: factor.prfSupported,
    wrappedKek: factor.wrappedKek,
    wrappedKekIv: factor.wrappedKekIv,
    wrappedMainKey: account.wrappedMainKey,
    wrappedMainKeyIv: account.wrappedMainKeyIv,
    needsMfa: false,
    factorsNeeded: [],
  };
  return c.json(response);
});

/* ============================================================================
 * Local helpers (kept private — no other route needs these)
 * ========================================================================== */

/**
 * Loose stand-in for `AuthenticationExtensionsClientInputs`. The
 * `@simplewebauthn/server` lib's type doesn't include the `prf`
 * field yet, so we widen via this alias rather than `any`.
 */
type AuthenticationExtensionsClientInputsLike = Record<string, unknown>;

/**
 * Encode raw bytes as base64url (URL-safe, no padding). Mirror of
 * the web-side helper but inlined to keep the api package free of a
 * web-side import.
 */
function bytesToBase64Url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString('base64url');
}

/**
 * Decode base64url → fresh `Uint8Array` backed by its own
 * `ArrayBuffer`. `Buffer.from(value, 'base64url')` returns a
 * `Buffer` whose backing buffer is a Node-internal slab, which TS
 * widens to `ArrayBufferLike` — `@simplewebauthn/server` wants the
 * narrower `Uint8Array<ArrayBuffer>` form (its `Uint8Array_` alias),
 * so we rebuild into a freshly-allocated typed array. The return
 * type is left to inference so the narrow `<ArrayBuffer>` parameter
 * survives at call sites.
 */
function base64UrlToBytes(value: string) {
  const src = Buffer.from(value, 'base64url');
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}

function parseTransports(
  csv: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  const parts = csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  // Browsers / authenticators report a wider transport set than what
  // `AuthenticatorTransportFuture` enumerates today; we trust the
  // round-tripped values without filtering since storage was already
  // controlled by us at enrollment.
  return parts as AuthenticatorTransportFuture[];
}

/**
 * Match a Postgres unique-constraint violation by SQLSTATE + constraint
 * name. Inlined here (same as `auth.ts`) to avoid the import cycle —
 * the helper is small enough that duplication beats coupling.
 */
function isUniqueViolation(err: unknown, constraint: string): boolean {
  let e: unknown = err;
  while (typeof e === 'object' && e !== null) {
    const rec = e as { code?: unknown; constraint_name?: unknown; cause?: unknown };
    if (rec.code === '23505' && rec.constraint_name === constraint) return true;
    e = rec.cause;
  }
  // Fallback — postgres.js wraps the underlying error differently in
  // some test paths. Match the constraint name in the message string
  // for that case.
  if (
    typeof err === 'object' &&
    err !== null &&
    'message' in err &&
    typeof (err as { message: unknown }).message === 'string'
  ) {
    return (err as { message: string }).message.includes(constraint);
  }
  return false;
}

// `randomBytes` is imported eagerly because future routes will use it;
// reference once to silence TS6133 until that lands.
void randomBytes;
