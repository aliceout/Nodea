import { Hono } from 'hono';
import { and, eq, isNull } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterSubmitBodySchema,
  RegisterActivateBodySchema,
  type RegisterModeResponse,
  type InviteInfoResponse,
} from '@nodea/shared/schemas/auth-register-v2';
import { db } from '../db/client.ts';
import { users } from '../db/schema.ts';
import {
  consumeInviteAndCreateUser,
  findValidInvite,
} from '../auth/invites.ts';
import { hashPassword } from '../auth/password.ts';
import { checkPasswordPolicy } from '../auth/password-policy.ts';
import {
  consumeEmailVerification,
  createEmailVerification,
  invalidatePendingVerifications,
} from '../auth/email-verifications.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderRegisterActivateEmail } from '../services/email/templates/register-activate.ts';
import { getConfig } from '../config.ts';
import { isOpenRegistration } from '../services/settings.ts';

/**
 * Register flow — two paths into a single submit endpoint
 * (Auth-Roadmap Phase 1, post-rework).
 *
 * Invited path:  /register?invite=<token> → form pre-filled with the
 *                invite's email (read-only) → submit hits this route
 *                with `inviteToken` → account created activated.
 *                One email exchange total (the invite itself).
 *
 * Open path:     /register without a token, when admin has flipped
 *                `open_registration = true` → submit creates an
 *                inactive account → activation email sent → user
 *                clicks → `/auth/register/activate` flips the flag.
 *                Two email exchanges total.
 *
 * Closed:        /register without a token, open_registration = false
 *                → submit returns 403; the frontend pre-checks via
 *                `GET /register/mode` and shows an "invitation only"
 *                page rather than the form.
 */
export const authRegisterV2Routes = new Hono();

const submitLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-submit',
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

/* ============================================================================
 * GET /auth/register/mode
 * Public. Tells the frontend whether open registration is on so the
 * UI can branch between the form and the "invitation only" page.
 * ========================================================================== */
authRegisterV2Routes.get('/mode', async (c) => {
  const response: RegisterModeResponse = {
    openRegistration: await isOpenRegistration(),
  };
  return c.json(response);
});

/* ============================================================================
 * GET /auth/register/invite-info?token=…
 * Public, rate-limited. Returns the email an invite was issued for,
 * so the register page can pre-fill (read-only) the email field.
 * 404 on invalid/expired/consumed tokens.
 * ========================================================================== */
authRegisterV2Routes.get('/invite-info', inviteInfoLimiter, async (c) => {
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
  return c.json(response);
});

/* ============================================================================
 * POST /auth/register
 *
 * The branching logic:
 *   - `inviteToken` present → invited path (strict email match,
 *     account activated immediately).
 *   - No token + open_registration on → open path (account inactive,
 *     activation email sent).
 *   - No token + open_registration off → 403 registration_closed.
 *
 * Errors are NOT silenced anti-enum-style here for the invited path:
 * the recipient already proved they have the link, so showing them
 * a precise "email mismatch" or "invalid token" response helps debug
 * a misclicked or stale link. Open path stays anti-enum (silent 200
 * on valid-shape submissions even when the email is in use).
 * ========================================================================== */
authRegisterV2Routes.post('/', submitLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterSubmitBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();
  const username = body.username;

  // Password policy applies to both paths — no anti-enum wiggle here.
  const policy = checkPasswordPolicy(body.password, [email]);
  if (!policy.ok) {
    return c.json({ error: 'weak_password', reason: policy.reason }, 400);
  }

  const passwordHash = await hashPassword(body.password);

  // ---- Invited path -------------------------------------------------
  if (body.inviteToken) {
    const result = await consumeInviteAndCreateUser(
      body.inviteToken,
      email,
      async (tx) => {
        // Username uniqueness lives INSIDE the tx so that a re-used /
        // expired invite still reports `invalid_token` first — the
        // token validation has already run before we get here. Run
        // the lookup against the same tx for read consistency under
        // SERIALIZABLE if we ever bump the isolation level.
        const [usernameClash] = await tx
          .select({ id: users.id })
          .from(users)
          .where(eq(users.username, username))
          .limit(1);
        if (usernameClash) throw new Error('username_taken');

        const userId = randomUUID();
        try {
          await tx.insert(users).values({
            id: userId,
            email,
            username,
            passwordHash,
            encryptionSalt: body.encryptionSalt,
            encryptedKey: body.encryptedKey,
            registerState: 'complete',
            // Click on the invite link == proof of email control,
            // so the account is activated immediately.
            emailVerifiedAt: new Date(),
          });
        } catch {
          // Constraint violation — most likely email already taken
          // (race or admin invited an existing user). Username
          // conflict was pre-checked above so it'd only land here on
          // a race; both surface as `email_taken` for V1 simplicity.
          throw new Error('email_taken');
        }
        return { userId, result: { userId, email } };
      },
    ).catch((err: unknown) => {
      if (err instanceof Error && err.message === 'email_taken') {
        return { ok: false as const, reason: 'email_taken' as const };
      }
      if (err instanceof Error && err.message === 'username_taken') {
        return { ok: false as const, reason: 'username_taken' as const };
      }
      throw err;
    });

    if (!result.ok) {
      const status =
        result.reason === 'email_mismatch' ||
        result.reason === 'email_taken' ||
        result.reason === 'username_taken'
          ? 400
          : 401;
      return c.json({ error: 'register_failed', reason: result.reason }, status);
    }

    // No session emitted: per UX decision, the user re-types their
    // password on /login?activated=1 (defensive, mirrors the open
    // path which can't auto-login either since activation happens on
    // a different device).
    return c.json({ ok: true, activated: true, email: result.result.email });
  }

  // ---- Open path ----------------------------------------------------
  if (!(await isOpenRegistration())) {
    return c.json({ error: 'registration_closed' }, 403);
  }

  // Anti-enum: silent 200 from here on, even when the email is taken
  // or in use. Same shape as the original Phase 1 reworked behavior.
  const [existing] = await db
    .select({
      id: users.id,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Username conflict check on the open path: usernames are public
  // info so we surface the clash directly. Allow self-conflict when
  // reusing an inactive account (the same person retrying with the
  // same username they already typed before).
  const usernameOwners = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, username))
    .limit(1);
  const usernameTakenByOther = usernameOwners.some(
    (row) => !existing || row.id !== existing.id,
  );
  if (usernameTakenByOther) {
    return c.json(
      { error: 'register_failed', reason: 'username_taken' },
      400,
    );
  }

  let userId: string;

  if (existing) {
    if (existing.emailVerifiedAt !== null) {
      // Active user — silent skip.
      return c.json({ ok: true, activated: false });
    }
    // Reuse the inactive row + refresh credentials in case the user
    // typed a different password (or username) the second time around.
    userId = existing.id;
    await db
      .update(users)
      .set({
        passwordHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
        username,
      })
      .where(eq(users.id, userId));
  } else {
    userId = randomUUID();
    try {
      await db.insert(users).values({
        id: userId,
        email,
        username,
        passwordHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
        registerState: 'complete',
      });
    } catch {
      // Race: someone created the user between SELECT and INSERT.
      // Anti-enum bail.
      return c.json({ ok: true, activated: false });
    }
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
    const rendered = renderRegisterActivateEmail({ link });
    await getEmailService().send({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
      tag: 'register-activate',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth/register] activation email send failed', err);
  }

  return c.json({ ok: true, activated: false });
});

/* ============================================================================
 * POST /auth/register/activate
 *
 * Magic-link target for the OPEN registration path. Invited users
 * never hit this — their account is activated at submit time.
 * ========================================================================== */
authRegisterV2Routes.post('/activate', activateLimiter, async (c) => {
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
    // eslint-disable-next-line no-console
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

  return c.json({ ok: true, email: updated.email });
});
