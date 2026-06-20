/**
 * Passkey enrollment routes: `POST /auth/passkeys/enroll/start` + `/finish`.
 *
 * Where: api auth route layer (combined into `auth-passkey.ts`, mounted at
 * `/auth`), behind requireUser.
 *
 * Non-obvious: enroll requires a PRF-capable, user-verifying authenticator
 * — `uv !== true` is rejected with `user_verification_required`/400 (only
 * enroll surfaces this distinct code). The new KEK wrap is AAD-bound to the
 * credential id. Bucket `passkey-enroll` (10/15min).
 */
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { RegistrationResponseJSON } from '@simplewebauthn/server';
import {
  PasskeyEnrollFinishBodySchema,
  PasskeyEnrollFinishResponseSchema,
  PasskeyEnrollStartBodySchema,
  PasskeyEnrollStartResponseSchema,
  type PasskeyEnrollFinishResponse,
  type PasskeyEnrollStartResponse,
} from '@nodea/shared';

import { getConfig } from '../config.ts';
import { db } from '../db/client.ts';
import { authFactors, sessions } from '../db/schema.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';
import { requireUser } from '../middleware/require-user.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
} from '../openapi/index.ts';

import { isUniqueViolation } from './auth-shared.ts';
import {
  bytesToBase64Url,
  enrollLimiter,
  parseTransports,
  userIdToHandle,
  type AuthenticationExtensionsClientInputsLike,
} from './passkey-helpers.ts';

export const authPasskeyEnrollRoutes = makeAuthedRouter();

const enrollStartRoute = createRoute({
  method: 'post',
  path: '/passkeys/enroll/start',
  tags: ['auth-passkey'],
  summary: 'Start passkey enrollment (re-auth gated)',
  middleware: [requireUser, requireFreshPassword, enrollLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: PasskeyEnrollStartBodySchema } },
    },
  },
  responses: {
    200: jsonContent(PasskeyEnrollStartResponseSchema, 'WebAuthn creationOptions'),
    400: errorContent('Invalid body'),
    401: errorContent('Unauthenticated or stale re-auth'),
    429: errorContent('Rate limit exceeded'),
  },
});

const enrollFinishRoute = createRoute({
  method: 'post',
  path: '/passkeys/enroll/finish',
  tags: ['auth-passkey'],
  summary: 'Finish passkey enrollment',
  middleware: [requireUser, enrollLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: PasskeyEnrollFinishBodySchema } },
    },
  },
  responses: {
    200: jsonContent(PasskeyEnrollFinishResponseSchema, 'New passkey id'),
    400: errorContent('Invalid body, no challenge, or verification failed'),
    401: errorContent('Unauthenticated'),
    409: errorContent('Authenticator already enrolled'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * POST /auth/passkeys/enroll/start
 * ========================================================================== */

authPasskeyEnrollRoutes.openapi(enrollStartRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyEnrollStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const user = c.get('user');

  // Pull the user's existing passkey credential ids so the
  // browser refuses to enroll the same authenticator twice.
  // Anti-double-enrollment is a UX-only concern — duplicate
  // enrollments would produce an
  // `auth_factors_credential_id_unique` collision at /finish
  // anyway, but failing in the browser is friendlier.
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
      // exactOptionalPropertyTypes : only include the
      // `transports` key when we actually have one.
      // Spreading a conditional object keeps the shape
      // strictly { id } | { id, transports }.
      return transports !== undefined
        ? { id: row.credentialId, transports }
        : { id: row.credentialId };
    }),
    // PRF extension — `eval` carries our fixed 32-byte
    // input so the PRF output is deterministic for a given
    // (credential, input) pair across logins. Enrollment
    // doesn't use the output yet (the client wraps the KEK
    // at /finish, after `prfOutput` surfaces) ; we still
    // pass it so the authenticator picks up the extension
    // request.
    extensions: { prf: {} } as unknown as AuthenticationExtensionsClientInputsLike,
  });

  // Persist the challenge on the session row.
  // `pending_webauthn_*` columns exist on `sessions`
  // precisely for this. Single-instance assumption : the
  // session ID identifies one Hono process, so the /finish
  // call lands in the same memory.
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
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/passkeys/enroll/finish
 * ========================================================================== */

authPasskeyEnrollRoutes.openapi(enrollFinishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = PasskeyEnrollFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const user = c.get('user');
  const sessionId = c.get('sessionId');

  // Refuse early if the wrap blob shape is incoherent with
  // the PRF flag. `prfSupported = true` ⇒ both blobs
  // non-null. `prfSupported = false` ⇒ both blobs null.
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
    // Defence-in-depth : `requireUserVerification: true`
    // should have already rejected, but spec compliance
    // demands the server double-check the flag (Auth-Spec
    // §9.3).
    return c.json({ error: 'user_verification_required' }, 400);
  }

  // Encode public key + credential id to base64url for
  // storage. Both are `Uint8Array_` from the lib — we keep
  // them as base64url so DB lookups + AAD building (passkey
  // AAD uses the credential id verbatim) can stay
  // string-typed end-to-end.
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
  return c.json(response, 200);
});
