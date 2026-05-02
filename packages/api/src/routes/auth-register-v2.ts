import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  InviteInfoResponseSchema,
  OpaqueRegisterStartBodySchema,
  OpaqueRegisterStartResponseSchema,
  OpaqueRegisterFinishBodySchema,
  RegisterActivateBodySchema,
  RegisterModeResponseSchema,
  type OpaqueRegisterStartResponse,
  type RegisterModeResponse,
  type InviteInfoResponse,
} from '@nodea/shared';
import { OpenAPIHono } from '@hono/zod-openapi';
import { db } from '../db/client.ts';
import { opaqueRecords, users } from '../db/schema.ts';
import {
  consumeInviteAndCreateUser,
  findValidInvite,
} from '../auth/invites.ts';
import {
  createRegistrationResponse,
  opaqueReady,
} from '../auth/opaque.ts';
import {
  consumeEmailVerification,
  createEmailVerification,
  invalidatePendingVerifications,
} from '../auth/email-verifications.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderRegisterActivateEmail } from '../services/email/templates/register-activate.ts';
import { extractEmailLanguage } from '../services/email/i18n.ts';
import { getConfig } from '../config.ts';
import { isOpenRegistration } from '../services/settings.ts';
import {
  createRoute,
  errorContent,
  jsonContent,
  z,
} from '../openapi/index.ts';

/**
 * Register flow — OPAQUE 2-step (Auth-Roadmap Phase 2B).
 *
 * Replaces the single Argon2id-based POST /auth/register from Phase
 * 1 with the canonical OPAQUE handshake: the client commits to a
 * password locally and never sends it to the server. Two routes:
 *
 *   - POST /auth/register/start   → exchanges the client's
 *                                   `registrationRequest` for the
 *                                   server's `registrationResponse`
 *                                   plus a fresh `userId` the client
 *                                   uses for AAD bindings.
 *   - POST /auth/register/finish  → receives the persisted
 *                                   `registrationRecord` (envelope)
 *                                   plus the wrapped main key + KEK
 *                                   blobs, performs the same
 *                                   invited / open / closed
 *                                   branching as Phase 1, and
 *                                   inserts the user + envelope.
 *
 * The `/start` step is stateless: the OPAQUE protocol's server
 * state lives entirely on the client (`clientRegistrationState`),
 * and the userId we hand out is just a UUID — no DB row exists
 * until /finish.
 *
 * GET /mode, GET /invite-info, POST /activate stay unchanged from
 * Phase 1 — they're orthogonal to the credential exchange.
 */
export const authRegisterV2Routes = new OpenAPIHono({
  defaultHook: (result, c) => {
    if (!result.success) return c.json({ error: 'invalid_body' }, 400);
    return undefined;
  },
});

const startLimiter = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-start',
});

const finishLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-finish',
});

const activateLimiter = rateLimit({
  max: 20,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-activate',
});

const inviteInfoLimiter = rateLimit({
  max: 30,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-invite-info',
});

const RegisterFinishResponseSchema = z.object({
  ok: z.literal(true),
  activated: z.boolean().optional(),
  email: z.string().email().optional(),
});

const RegisterActivateResponseSchema = z.object({
  ok: z.literal(true),
  email: z.string().email(),
});

const modeRoute = createRoute({
  method: 'get',
  path: '/mode',
  tags: ['auth-register'],
  summary: 'Public registration mode flag',
  responses: {
    200: jsonContent(RegisterModeResponseSchema, 'Open or invite-only'),
  },
});

const inviteInfoRoute = createRoute({
  method: 'get',
  path: '/invite-info',
  tags: ['auth-register'],
  summary: 'Peek invite token info (anti-enum 404)',
  middleware: [inviteInfoLimiter] as const,
  request: {
    // `token` is validated inside the handler (length + presence) so a
    // missing / too-short token returns 404 (anti-enum) rather than the
    // 400 the lib's default validation hook would emit. Keeping the
    // schema permissive at the OpenAPI layer matches the existing
    // wire contract.
    query: z.object({ token: z.string().optional() }),
  },
  responses: {
    200: jsonContent(InviteInfoResponseSchema, 'Invite info'),
    404: errorContent('Invalid or expired token'),
    429: errorContent('Rate limit exceeded'),
  },
});

const startRoute = createRoute({
  method: 'post',
  path: '/start',
  tags: ['auth-register'],
  summary: 'Register — step 1 (OPAQUE start)',
  middleware: [startLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: OpaqueRegisterStartBodySchema } } },
  },
  responses: {
    200: jsonContent(OpaqueRegisterStartResponseSchema, 'OPAQUE response + tentative userId'),
    400: errorContent('Invalid body or email mismatch'),
    401: errorContent('Invalid invite token'),
    403: errorContent('Registration closed'),
    429: errorContent('Rate limit exceeded'),
  },
});

const finishRoute = createRoute({
  method: 'post',
  path: '/finish',
  tags: ['auth-register'],
  summary: 'Register — step 2 (insert user + envelope)',
  middleware: [finishLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: OpaqueRegisterFinishBodySchema } } },
  },
  responses: {
    200: jsonContent(RegisterFinishResponseSchema, 'Registration completed'),
    400: errorContent('Invalid body or email mismatch'),
    401: errorContent('Invalid invite token'),
    403: errorContent('Registration closed'),
    429: errorContent('Rate limit exceeded'),
  },
});

const activateRoute = createRoute({
  method: 'post',
  path: '/activate',
  tags: ['auth-register'],
  summary: 'Activate account from magic link',
  middleware: [activateLimiter] as const,
  request: {
    body: { content: { 'application/json': { schema: RegisterActivateBodySchema } } },
  },
  responses: {
    200: jsonContent(RegisterActivateResponseSchema, 'Account activated'),
    400: errorContent('Invalid body'),
    401: errorContent('Invalid token or already consumed'),
    410: errorContent('Token expired'),
    429: errorContent('Rate limit exceeded'),
    500: errorContent('Internal error'),
  },
});

/* ============================================================================
 * GET /auth/register/mode
 * Public. Tells the frontend whether open registration is on so the
 * UI can branch between the form and the "invitation only" page.
 * ========================================================================== */
authRegisterV2Routes.openapi(modeRoute, async (c) => {
  const response: RegisterModeResponse = {
    openRegistration: await isOpenRegistration(),
  };
  return c.json(response, 200);
});

/* ============================================================================
 * GET /auth/register/invite-info?token=…
 * Public, rate-limited. Returns the email an invite was issued for,
 * so the register page can pre-fill (read-only) the email field.
 * 404 on invalid/expired/consumed tokens.
 * ========================================================================== */
authRegisterV2Routes.openapi(inviteInfoRoute, async (c) => {
  const token = c.req.query('token');
  if (!token || token.length < 16) {
    return c.json({ error: 'invalid_token' }, 404);
  }
  const info = await findValidInvite(token);
  if (!info) return c.json({ error: 'invalid_token' }, 404);
  const response: InviteInfoResponse = {
    email: info.email,
    expiresAt: info.expiresAt ? info.expiresAt.toISOString() : null,
  };
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/register/start
 *
 * Step 1 of OPAQUE registration. Stateless: no DB writes, no token
 * consumed. We pre-validate enough of the context (invite present
 * + matches email, or open_registration on) to refuse early — the
 * client shouldn't bother computing an envelope for a registration
 * that will be rejected at /finish anyway.
 *
 * Returns the OPAQUE response blob plus a fresh userId the client
 * embeds in its AAD computations. The userId only becomes
 * authoritative when /finish actually inserts the user row.
 * ========================================================================== */
authRegisterV2Routes.openapi(startRoute, async (c) => {
  await opaqueReady;

  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueRegisterStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();

  // Pre-validate the path so we fail fast — the actual invite
  // consumption + DB writes happen at /finish in a transaction.
  if (body.inviteToken) {
    const invite = await findValidInvite(body.inviteToken);
    if (!invite) {
      return c.json({ error: 'register_failed', reason: 'invalid_token' }, 401);
    }
    if (invite.email.toLowerCase() !== email) {
      return c.json(
        { error: 'register_failed', reason: 'email_mismatch' },
        400,
      );
    }
  } else {
    if (!(await isOpenRegistration())) {
      return c.json({ error: 'registration_closed' }, 403);
    }
  }

  // OPAQUE: produce the registration response. `userIdentifier` is
  // the lowercased email per Auth-Spec §7.6 (changing email later
  // requires re-registering OPAQUE). The lib is stateless here; the
  // client owns the `clientRegistrationState`.
  //
  // The lib throws on a malformed `registrationRequest` (truncated
  // base64, wrong curve point, etc.). We catch and surface as 400
  // rather than letting it bubble up as a 500 — only a misbehaving
  // or malicious client can produce that input.
  let registrationResponse: string;
  try {
    ({ registrationResponse } = createRegistrationResponse({
      userIdentifier: email,
      registrationRequest: body.registrationRequest,
    }));
  } catch {
    return c.json({ error: 'invalid_body' }, 400);
  }

  const response: OpaqueRegisterStartResponse = {
    registrationResponse,
    userId: randomUUID(),
  };
  return c.json(response, 200);
});

/* ============================================================================
 * POST /auth/register/finish
 *
 * Step 2 of OPAQUE registration. Same invited / open / closed
 * branching as Phase 1's single-step submit, except the credential
 * payload is now the OPAQUE registration record + the wrapped main
 * key + the wrapped KEK (under the OPAQUE `exportKey`-derived key).
 *
 *   - `inviteToken` present → consume invite atomically + INSERT
 *     user (activated) + INSERT opaque_records.
 *   - No token + open_registration on → INSERT inactive user +
 *     INSERT opaque_records + send activation email.
 *   - No token + open_registration off → 403 (the /start step
 *     should have caught this; defense-in-depth in case the toggle
 *     flipped between the two calls).
 *
 * Anti-enum on the open path: existing-active-email → silent 200,
 * existing-inactive-email → silent 200 (the OPAQUE flow can't
 * cleanly reuse an inactive row because the AAD on the new
 * envelope was computed against the userId issued at /start, not
 * the existing user's id; the original activation email is still
 * valid).
 * ========================================================================== */
authRegisterV2Routes.openapi(finishRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = OpaqueRegisterFinishBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();
  const username = body.username;
  const userId = body.userId;

  // ---- Invited path -------------------------------------------------
  if (body.inviteToken) {
    const result = await consumeInviteAndCreateUser(
      body.inviteToken,
      email,
      async (tx) => {
        try {
          await tx.insert(users).values({
            id: userId,
            email,
            username,
            wrappedMainKey: body.wrappedMainKey,
            wrappedMainKeyIv: body.wrappedMainKeyIv,
            wrappedKekPassword: body.wrappedKekPassword,
            wrappedKekPasswordIv: body.wrappedKekPasswordIv,
            registerState: 'complete',
            // Click on the invite link == proof of email control,
            // so the account is activated immediately.
            emailVerifiedAt: new Date(),
          });
          await tx.insert(opaqueRecords).values({
            userId,
            envelope: body.registrationRecord,
          });
        } catch {
          // Constraint violation — most likely email already taken,
          // or a userId collision (vanishingly unlikely with UUIDv4
          // but possible if the client misbehaves and reuses an old
          // /start userId).
          throw new Error('email_taken');
        }
        return { userId, result: { userId, email } };
      },
    ).catch((err: unknown) => {
      if (err instanceof Error && err.message === 'email_taken') {
        return { ok: false as const, reason: 'email_taken' as const };
      }
      throw err;
    });

    if (!result.ok) {
      const status =
        result.reason === 'email_mismatch' || result.reason === 'email_taken'
          ? 400
          : 401;
      return c.json({ error: 'register_failed', reason: result.reason }, status);
    }

    return c.json({ ok: true as const, activated: true, email: result.result.email }, 200);
  }

  // ---- Open path ----------------------------------------------------
  if (!(await isOpenRegistration())) {
    return c.json({ error: 'registration_closed' }, 403);
  }

  // Anti-enum: silent 200 from here on, even when the email is in
  // use. Username is a free-form display name with no uniqueness
  // constraint — duplicates are allowed.
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing) {
    // Whether active or inactive, we silent-200 here. Reusing an
    // inactive row would require re-doing the OPAQUE handshake +
    // re-wrapping under the existing user's id — the current /start
    // already issued a fresh userId, so the AAD bindings on the
    // submitted blobs don't match the existing row. The original
    // activation email (if any) is still valid; admin can resend
    // out-of-band if the user lost it.
    return c.json({ ok: true as const, activated: false }, 200);
  }

  try {
    await db.transaction(async (tx) => {
      await tx.insert(users).values({
        id: userId,
        email,
        username,
        wrappedMainKey: body.wrappedMainKey,
        wrappedMainKeyIv: body.wrappedMainKeyIv,
        wrappedKekPassword: body.wrappedKekPassword,
        wrappedKekPasswordIv: body.wrappedKekPasswordIv,
        registerState: 'complete',
      });
      await tx.insert(opaqueRecords).values({
        userId,
        envelope: body.registrationRecord,
      });
    });
  } catch {
    // Race: someone created the user between SELECT and INSERT, or
    // the client reused a stale userId. Anti-enum bail.
    return c.json({ ok: true as const, activated: false }, 200);
  }

  await invalidatePendingVerifications(email, 'register');
  const { token } = await createEmailVerification({
    userId,
    email,
    kind: 'register',
  });

  const cfg = getConfig();
  const base = (cfg.WEB_BASE_URL ?? '').replace(/\/$/, '');
  const link = `${base}/activate?token=${encodeURIComponent(token)}`;

  try {
    const rendered = renderRegisterActivateEmail({
      link,
      language: extractEmailLanguage(c),
    });
    await getEmailService().send({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tag: 'register-activate',
    });
  } catch (err) {

    console.error('[auth/register] activation email send failed', err);
  }

  return c.json({ ok: true as const, activated: false }, 200);
});

/* ============================================================================
 * POST /auth/register/activate
 *
 * Magic-link target for the OPEN registration path. Invited users
 * never hit this — their account is activated at /finish.
 * Unchanged from Phase 1 — orthogonal to the credential exchange.
 * ========================================================================== */
authRegisterV2Routes.openapi(activateRoute, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterActivateBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);

  const result = await consumeEmailVerification('register', parsed.data.token);
  if (!result.ok) {
    const status = result.reason === 'expired' ? 410 : 401;
    return c.json({ error: 'activation_failed', reason: result.reason }, status);
  }

  const verification = result.verification;
  if (!verification.userId) {

    console.error(
      '[auth/register/activate] verification consumed but userId is null',
      { verificationId: verification.id },
    );
    return c.json({ error: 'internal' }, 500);
  }

  const [updated] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.id, verification.userId), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id, email: users.email });

  if (!updated) {
    return c.json(
      { error: 'activation_failed', reason: 'already_consumed' },
      401,
    );
  }

  return c.json({ ok: true as const, email: updated.email }, 200);
});
