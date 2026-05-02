import { eq } from 'drizzle-orm';
import {
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server';
import {
  ReauthPasskeyFinishBodySchema,
  ReauthPasskeyStartBodySchema,
  ReauthPasskeyStartResponseSchema,
  ReauthPasswordFinishBodySchema,
  ReauthPasswordStartBodySchema,
  ReauthPasswordStartResponseSchema,
  type ReauthOkResponse,
  type ReauthPasskeyStartResponse,
  type ReauthPasswordStartResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { authFactors, sessions, opaqueRecords, users } from '../db/schema.ts';
import {
  finishLogin as opaqueFinishLogin,
  opaqueReady,
  startLogin as opaqueStartLogin,
} from '../auth/opaque.ts';
import {
  consumeLoginState,
  storeLoginState,
} from '../auth/opaque-login-state.ts';
import { bumpSessionReauth } from '../auth/session.ts';
import { getConfig } from '../config.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
  okContent,
} from '../openapi/index.ts';

/**
 * Re-auth routes (Auth-Roadmap Phase 7A, Auth-Spec §5.3).
 *
 * The user already has a `full` session — these endpoints just
 * prove a factor (password via OPAQUE, or passkey via WebAuthn) and
 * bump the corresponding `reauth_*_at` timestamp so subsequent
 * mutating actions can pass `requireFreshPassword` /
 * `requireFreshPasswordOrPasskey` in the next 5 minutes.
 *
 * Identifier discipline (anti-confused-deputy): the password proof
 * uses `users.email` from the session, NOT from the body. The
 * passkey verification matches the asserted credential against
 * `auth_factors.user_id = session.user_id`. Either way, an attacker
 * holding A's session cookie can't pass a proof against B's record.
 */
export const authReauthRoutes = makeAuthedRouter();

const limiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'reauth',
});

const reauthPasswordStartRoute = createRoute({
  method: 'post',
  path: '/reauth/password/start',
  tags: ['auth-reauth'],
  summary: 'Reauth password — step 1 (OPAQUE start)',
  middleware: [requireUser, limiter] as const,
  request: { body: { content: { 'application/json': { schema: ReauthPasswordStartBodySchema } } } },
  responses: {
    200: jsonContent(ReauthPasswordStartResponseSchema, 'OPAQUE login response + token'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
    429: errorContent('Rate limit exceeded'),
  },
});

const reauthPasswordFinishRoute = createRoute({
  method: 'post',
  path: '/reauth/password/finish',
  tags: ['auth-reauth'],
  summary: 'Reauth password — step 2 (bump freshness)',
  middleware: [requireUser, limiter] as const,
  request: { body: { content: { 'application/json': { schema: ReauthPasswordFinishBodySchema } } } },
  responses: {
    200: okContent('Freshness bumped'),
    400: errorContent('Invalid body'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

const reauthPasskeyStartRoute = createRoute({
  method: 'post',
  path: '/reauth/passkey/start',
  tags: ['auth-reauth'],
  summary: 'Reauth passkey — step 1 (challenge)',
  middleware: [requireUser, limiter] as const,
  request: { body: { content: { 'application/json': { schema: ReauthPasskeyStartBodySchema } } } },
  responses: {
    200: jsonContent(ReauthPasskeyStartResponseSchema, 'WebAuthn requestOptions'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated'),
    429: errorContent('Rate limit exceeded'),
  },
});

const reauthPasskeyFinishRoute = createRoute({
  method: 'post',
  path: '/reauth/passkey/finish',
  tags: ['auth-reauth'],
  summary: 'Reauth passkey — step 2 (verify + bump freshness)',
  middleware: [requireUser, limiter] as const,
  request: { body: { content: { 'application/json': { schema: ReauthPasskeyFinishBodySchema } } } },
  responses: {
    200: okContent('Freshness bumped'),
    400: errorContent('Invalid body, no challenge, or expired'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * Password
 * ========================================================================== */

authReauthRoutes.openapi(reauthPasswordStartRoute, async (c) => {
  await opaqueReady;
  const raw = await c.req.json().catch(() => null);
  const parsed = ReauthPasswordStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const userIdentifier = user.email.toLowerCase();

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
      startLoginRequest: parsed.data.startLoginRequest,
    });
    serverLoginState = result.serverLoginState;
    loginResponse = result.loginResponse;
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const loginToken = storeLoginState(serverLoginState, userIdentifier);
  const response: ReauthPasswordStartResponse = { loginResponse, loginToken };
  return c.json(response, 200);
});

authReauthRoutes.openapi(reauthPasswordFinishRoute, async (c) => {
  await opaqueReady;
  const raw = await c.req.json().catch(() => null);
  const parsed = ReauthPasswordFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const sessionId = c.get('sessionId');

  const pending = consumeLoginState(parsed.data.loginToken);
  if (!pending) return c.json({ error: 'invalid_credentials' }, 401);
  // Same-identifier guard — the /start above stamped the user's
  // email into the OPAQUE state. If it doesn't match the calling
  // session, abort.
  if (pending.userIdentifier !== user.email.toLowerCase()) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  try {
    opaqueFinishLogin({
      serverLoginState: pending.state,
      finishLoginRequest: parsed.data.finishLoginRequest,
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  await bumpSessionReauth(sessionId, 'password');
  const response: ReauthOkResponse = { ok: true };
  return c.json(response, 200);
});

/* ============================================================================
 * Passkey
 * ========================================================================== */

authReauthRoutes.openapi(reauthPasskeyStartRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ReauthPasskeyStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const sessionId = c.get('sessionId');
  const config = getConfig();

  const rows = await db
    .select({
      credentialId: authFactors.credentialId,
      transports: authFactors.transports,
    })
    .from(authFactors)
    .where(eq(authFactors.userId, user.id));

  const allowCredentials = rows.map((row) => {
    const transports = parseTransports(row.transports);
    return transports !== undefined
      ? { id: row.credentialId, transports }
      : { id: row.credentialId };
  });

  const requestOptions = await generateAuthenticationOptions({
    rpID: config.WEBAUTHN_RP_ID,
    userVerification: 'required',
    allowCredentials,
  });

  // Re-use the `pending_webauthn_challenge` column on the session
  // (TTL 5 min, same column the stepped-MFA path uses on
  // `mfa_pending` rows). Safe because the column is otherwise
  // unused on `full` sessions.
  await db
    .update(sessions)
    .set({
      pendingWebauthnChallenge: requestOptions.challenge,
      pendingWebauthnChallengeAt: new Date(),
    })
    .where(eq(sessions.id, sessionId));

  const response: ReauthPasskeyStartResponse = {
    requestOptions: requestOptions as unknown as Record<string, unknown>,
  };
  return c.json(response, 200);
});

authReauthRoutes.openapi(reauthPasskeyFinishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = ReauthPasskeyFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const sessionId = c.get('sessionId');

  const [sessionRow] = await db
    .select({
      challenge: sessions.pendingWebauthnChallenge,
      challengeAt: sessions.pendingWebauthnChallengeAt,
    })
    .from(sessions)
    .where(eq(sessions.id, sessionId))
    .limit(1);
  if (!sessionRow?.challenge || !sessionRow.challengeAt) {
    return c.json({ error: 'no_pending_challenge' }, 400);
  }
  if (Date.now() - sessionRow.challengeAt.getTime() > 5 * 60_000) {
    return c.json({ error: 'challenge_expired' }, 400);
  }

  const assertion = parsed.data.assertionResponse as unknown as AuthenticationResponseJSON;
  const assertionId = assertion.id;
  if (typeof assertionId !== 'string' || assertionId.length === 0) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const [factor] = await db
    .select()
    .from(authFactors)
    .where(eq(authFactors.credentialId, assertionId))
    .limit(1);
  if (!factor || factor.userId !== user.id) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  const config = getConfig();
  const transports = parseTransports(factor.transports);
  let verification: Awaited<ReturnType<typeof verifyAuthenticationResponse>>;
  try {
    verification = await verifyAuthenticationResponse({
      response: assertion,
      expectedChallenge: sessionRow.challenge,
      expectedOrigin: config.WEBAUTHN_ORIGIN,
      expectedRPID: config.WEBAUTHN_RP_ID,
      requireUserVerification: true,
      credential: {
        id: factor.credentialId,
        publicKey: base64UrlToBytes(factor.publicKey),
        counter: factor.signCount,
        ...(transports !== undefined ? { transports } : {}),
      },
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }
  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Sign-counter handling — same logic as primary login (§9.6).
  const newCounter = verification.authenticationInfo.newCounter;
  if (factor.signCountStrict) {
    if (newCounter > 0 && newCounter <= factor.signCount) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  }
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

  // Clear the single-use challenge + bump the freshness stamp.
  await db
    .update(sessions)
    .set({
      pendingWebauthnChallenge: null,
      pendingWebauthnChallengeAt: null,
    })
    .where(eq(sessions.id, sessionId));
  await bumpSessionReauth(sessionId, 'passkey');

  const response: ReauthOkResponse = { ok: true };
  return c.json(response, 200);
});

/* ============================================================================
 * Local helpers (mirrors of `auth-mfa.ts` — small, kept inline)
 * ========================================================================== */

function parseTransports(
  csv: string | null,
): AuthenticatorTransportFuture[] | undefined {
  if (!csv) return undefined;
  const parts = csv.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
  if (parts.length === 0) return undefined;
  return parts as AuthenticatorTransportFuture[];
}

function base64UrlToBytes(value: string) {
  const src = Buffer.from(value, 'base64url');
  const buf = new ArrayBuffer(src.byteLength);
  const out = new Uint8Array(buf);
  out.set(src);
  return out;
}
