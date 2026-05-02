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
  PasskeyLoginFinishBodySchema,
  PasskeyLoginFinishResponseSchema,
  PasskeyLoginStartBodySchema,
  PasskeyLoginStartResponseSchema,
  type PasskeyLoginFinishResponse,
  type PasskeyLoginStartResponse,
} from '@nodea/shared';

import { setSessionCookie } from '../auth/cookies.ts';
import {
  applyConsumableBypass,
  cancelPendingBypassesForUser,
} from '../auth/mfa-bypass.ts';
import { requiredFactorsForMode } from '../auth/mfa-policy.ts';
import {
  consumePasskeyLoginPending,
  storePasskeyLoginPending,
} from '../auth/passkey-login-state.ts';
import { createSession } from '../auth/session.ts';
import { getConfig } from '../config.ts';
import { db } from '../db/client.ts';
import { authFactors, mfaTotp, users } from '../db/schema.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderMfaBypassAppliedEmail } from '../services/email/templates/mfa-bypass.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  makeAuthedRouter,
} from '../openapi/index.ts';

import {
  base64UrlToBytes,
  loginLimiter,
  parseTransports,
  type AuthenticationExtensionsClientInputsLike,
} from './passkey-helpers.ts';

export const authPasskeyLoginRoutes = makeAuthedRouter();

const loginStartRoute = createRoute({
  method: 'post',
  path: '/passkeys/login/start',
  tags: ['auth-passkey'],
  summary: 'Start passkey-first login (anonymous, anti-enum)',
  middleware: [loginLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: PasskeyLoginStartBodySchema } },
    },
  },
  responses: {
    200: jsonContent(PasskeyLoginStartResponseSchema, 'WebAuthn requestOptions + token'),
    400: errorContent('Invalid body'),
    429: errorContent('Rate limit exceeded'),
  },
});

const loginFinishRoute = createRoute({
  method: 'post',
  path: '/passkeys/login/finish',
  tags: ['auth-passkey'],
  summary: 'Finish passkey-first login (anonymous)',
  middleware: [loginLimiter] as const,
  request: {
    body: {
      content: { 'application/json': { schema: PasskeyLoginFinishBodySchema } },
    },
  },
  responses: {
    200: jsonContent(PasskeyLoginFinishResponseSchema, 'Login finished — full session or mfa_pending'),
    400: errorContent('Invalid body'),
    401: errorContent('Invalid credentials'),
    429: errorContent('Rate limit exceeded'),
  },
});

/* ============================================================================
 * POST /auth/passkeys/login/start (anonymous)
 * ========================================================================== */

authPasskeyLoginRoutes.openapi(loginStartRoute, async (c) => {
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

    // Anti-enum : if the email is unknown we still produce
    // options (with a generic challenge + no
    // allowCredentials). The client prompt then fails (« no
    // credential available ») indistinguishably from « wrong
    // email » + « no passkey enrolled ».
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
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/passkeys/login/finish (anonymous)
 * ========================================================================== */

authPasskeyLoginRoutes.openapi(loginFinishRoute, async (c) => {
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

  // Look up the credential the assertion claims. For
  // email-bound starts we also enforce `userId` match —
  // protects against a crafted assertion from another user's
  // credential.
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
        // exactOptionalPropertyTypes : only spread when
        // defined.
        ...(transports !== undefined ? { transports } : {}),
      },
    });
  } catch {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  if (!verification.verified || !verification.authenticationInfo.userVerified) {
    return c.json({ error: 'invalid_credentials' }, 401);
  }

  // Sign-counter handling (Auth-Spec §9.6). When
  // `signCountStrict` is true, refuse `newCounter <=
  // signCount`. When the authenticator returns 0,
  // Apple-style — flip strict off after 3 consecutive 0s.
  // We approximate « 3 consecutive » by a simpler heuristic :
  // any-time-we-see-0-twice-in-a-row → flip. The downside is
  // one extra valid assertion before the strict check is
  // dropped ; the upside is no extra column.
  const newCounter = verification.authenticationInfo.newCounter;
  if (factor.signCountStrict) {
    if (newCounter > 0 && newCounter <= factor.signCount) {
      return c.json({ error: 'invalid_credentials' }, 401);
    }
  }

  // Load the wrapped main key + the user's security_mode so
  // we can decide whether to emit a `full` session or step
  // into MFA.
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

  // Bump counter + last_used_at + maybe flip strict. Single
  // statement — passkey login is on the hot path of every
  // session start.
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

  // MFA bypass lazy application (Auth-Roadmap Phase 6,
  // Auth-Spec §7.8). Same logic as the OPAQUE login flow :
  // consume any confirmed-past-48h bypass before computing
  // required factors.
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
          language: extractEmailLanguage(c),
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

          console.warn('[auth/passkey] mfa-bypass-applied mail failed', err);
        }
      }
      break;
    }
  }

  // Stepped MFA gate (Auth-Roadmap Phase 5C, Auth-Spec §7.4) :
  // same logic as the password-first path but with
  // `entryFactor=passkey`. Mode `maximum` is the case where
  // the passkey-first user still needs password + TOTP ; mode
  // `always_totp` just needs TOTP.
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
      // Same safety net as the password path : don't lock
      // the user out if mode requires TOTP but it's not
      // enrolled.
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
    return c.json(response, 200);
  }

  // Successful passkey-only login : defang any pending
  // bypass before minting the full session — see
  // `auth-login.ts` for rationale.
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
  return c.json(response, 200);
});
