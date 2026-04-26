import { Hono } from 'hono';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterStartBodySchema,
  RegisterSetPasswordBodySchema,
  VerifyEmailBodySchema,
  type RegisterStateResponse,
} from '@nodea/shared/schemas/auth-register-v2';
import { db } from '../db/client.ts';
import { invites, sessions, users } from '../db/schema.ts';
import { hashInviteCode } from '../auth/invites.ts';
import { hashPassword } from '../auth/password.ts';
import { checkPasswordPolicy } from '../auth/password-policy.ts';
import {
  consumeEmailVerification,
  createEmailVerification,
  invalidatePendingVerifications,
} from '../auth/email-verifications.ts';
import { createSession } from '../auth/session.ts';
import {
  clearRegisterCookie,
  setRegisterCookie,
  setSessionCookie,
} from '../auth/cookies.ts';
import {
  requireRegisterSession,
  type RegisterAuthVariables,
} from '../middleware/require-register-session.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderRegisterVerifyEmail } from '../services/email/templates/register-verify.ts';

/**
 * Multi-step register routes — Auth-Spec.md §7.1, Auth-Roadmap Phase 1B.
 *
 * Coexists with the legacy `POST /auth/register` (which stays for
 * back-compat / admin-created users). New frontend flows route
 * through this set instead.
 *
 * Three endpoints:
 *
 *   - `POST /auth/register/start`        anonymous, send code, no cookie
 *   - `POST /auth/register/verify-email` anonymous, validate code,
 *                                        emits register cookie
 *   - `GET  /auth/register/state`        register cookie required,
 *                                        returns current state for resume
 *
 * Steps 3+ (set-password, recovery code, optional TOTP/passkey, finish)
 * land in Phase 2+ once OPAQUE is wired.
 */
export const authRegisterV2Routes = new Hono<{
  Variables: RegisterAuthVariables;
}>();

// Auth-Spec.md §13: 5/h IP for /auth/register/*. We layer per-route
// limits on top of this catch-all so /verify-email gets its own bucket.
const startLimiter = rateLimit({
  max: 5,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-start',
});
const verifyLimiter = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-verify',
});

/**
 * Sentinel placeholder values for the legacy NOT NULL columns on the
 * `users` table. A `pre_register` row has no real password hash / KEK
 * envelope yet — those are populated in Phase 2 when OPAQUE wraps the
 * KEK at step 3 of the multi-step flow. The placeholders are deliberately
 * **non-verifiable** Argon2id-shaped strings: any login attempt against
 * such a user fails because `verifyPassword(placeholder, anyInput)`
 * returns false.
 *
 * When schema is relaxed in Phase 2 (the columns become nullable), these
 * placeholders go away and pre_register rows simply have NULL there.
 */
const PRE_REGISTER_PLACEHOLDER_PASSWORD_HASH =
  '$argon2id$v=19$m=19456,t=2,p=1$cGVuZGluZy1yZWdpc3Rlcg$cGVuZGluZy1yZWdpc3Rlci1ub3QtYS1yZWFsLWhhc2gh';
const PRE_REGISTER_PLACEHOLDER_SALT = 'pending-register';
const PRE_REGISTER_PLACEHOLDER_KEY = 'pending-register';

/**
 * `POST /auth/register/start` — Step 1.
 *
 * Anonymous. Always responds 200 (anti-enumeration). On a valid invite +
 * never-used email, creates a `pre_register` users row, generates a
 * 6-digit code, sends it by email. The invite is **looked up** but not
 * consumed yet (consumption happens in step 2 on successful verify) —
 * this lets the user retry step 1 without burning the invite.
 *
 * Returning 200 even when the invite is invalid mirrors the
 * `request-reset` anti-enum trick: an attacker can't probe whether
 * a given invite code is valid without solving the rate limit.
 */
authRegisterV2Routes.post('/start', startLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();

  // Step A — invite lookup (not consume). Hash side: timing-safe via
  // SHA-256 + indexed unique constraint.
  const codeHash = hashInviteCode(body.inviteCode);
  const now = new Date();
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.codeHash, codeHash))
    .limit(1);
  const inviteOk =
    invite &&
    !invite.usedBy &&
    (!invite.expiresAt || invite.expiresAt > now);

  if (!inviteOk) {
    // Don't leak invite validity. The user has the same UX as if the
    // email was sent — they "won't" find it in their inbox and will
    // wonder. Acceptable trade-off vs. enumeration of valid codes.
    return c.json({ ok: true });
  }

  // Step B — email uniqueness. If a `complete` user already has this
  // email, we silently skip creating anything (not even a pre_register
  // shadow row). Anti-enum: same response either way.
  const [existing] = await db
    .select({ id: users.id, registerState: users.registerState })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existing && existing.registerState !== 'pre_register') {
    // Email belongs to a real user — can't shadow with pre_register.
    return c.json({ ok: true });
  }

  // Step C — find or create the pre_register row. Reusing an existing
  // pre_register row (rather than insert-or-update dance) preserves the
  // invite linkage from the previous start attempt and keeps the
  // resume UX sane.
  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    userId = randomUUID();
    try {
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash: PRE_REGISTER_PLACEHOLDER_PASSWORD_HASH,
        encryptionSalt: PRE_REGISTER_PLACEHOLDER_SALT,
        encryptedKey: PRE_REGISTER_PLACEHOLDER_KEY,
        registerState: 'pre_register',
      });
    } catch (err) {
      // Concurrency race: someone else created the row between our
      // SELECT and INSERT. Refetch and use what's there.
      const [row] = await db
        .select({ id: users.id, registerState: users.registerState })
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      if (!row || row.registerState !== 'pre_register') {
        // Lost the race to a real registration — bail without leaking.
        return c.json({ ok: true });
      }
      userId = row.id;
    }
  }

  // Step D — invalidate any earlier pending verification (defensive),
  // then issue a fresh code.
  await invalidatePendingVerifications(email, 'register');
  const { code } = await createEmailVerification({
    userId,
    email,
    kind: 'register',
  });

  // Step E — send. Wrap in try/catch so a transient SMTP failure
  // doesn't leak via response shape; we still return 200.
  try {
    const rendered = renderRegisterVerifyEmail({ code });
    await getEmailService().send({
      to: email,
      subject: rendered.subject,
      text: rendered.text,
      ...(rendered.html ? { html: rendered.html } : {}),
      tag: 'register-verify',
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[auth/register/start] email send failed', err);
  }

  return c.json({ ok: true });
});

/**
 * `POST /auth/register/verify-email` — Step 2.
 *
 * Anonymous (no cookie yet). Validates the 6-digit code, transitions
 * the users row to `register_state = 'email_verified'`, consumes the
 * invite atomically, and emits the register session cookie. From this
 * point on, the client uses `GET /register/state` and the upcoming
 * step-3+ routes with the cookie.
 */
authRegisterV2Routes.post('/verify-email', verifyLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = VerifyEmailBodySchema.safeParse(raw);
  if (!parsed.success) {
    return c.json({ error: 'invalid_body' }, 400);
  }
  const email = parsed.data.email.toLowerCase();
  const code = parsed.data.code;

  // Validate code FIRST — gives us a constant-ish-time response shape
  // regardless of whether the user/invite combo exists, since the
  // hash compare runs every call.
  const consumeResult = await consumeEmailVerification(email, 'register', code);
  if (!consumeResult.ok) {
    // Map internal reasons to HTTP status. All client-fixable failures
    // are 401 with `reason` so the UI can localise; 410 for expired
    // (semantically "gone").
    if (consumeResult.reason === 'expired') {
      return c.json({ error: 'verification_failed', reason: consumeResult.reason }, 410);
    }
    return c.json({ error: 'verification_failed', reason: consumeResult.reason }, 401);
  }

  // Code OK — locate the pre_register user. The verification carries
  // userId in nominal cases (set at step 1) but be defensive in case of
  // schema drift or manual fixtures.
  const userId = consumeResult.verification.userId;
  if (!userId) {
    // Verification succeeded but we have no user to graduate — log and
    // fail soft. This is an internal invariant violation, not a user
    // error.
    // eslint-disable-next-line no-console
    console.error(
      '[auth/register/verify-email] verification consumed but userId is null',
      { email, verificationId: consumeResult.verification.id },
    );
    return c.json({ error: 'internal' }, 500);
  }

  // Atomic transition: graduate the user + consume the invite.
  // We re-look the invite via the latest pending verification's owner
  // because the invite link is implicit (the invite was looked up but
  // not consumed in step 1). To stay simple in 1B we re-validate via
  // codeHash — the user who started supplied a code we never persist
  // post-step-1, so we can't re-check directly. Instead we accept that
  // any pre_register user reaching verify-email already proved invite
  // possession at step 1, and we just consume "any pending invite
  // that was used by this email's pre_register row" — but invites are
  // not yet linked to users until consumed. So in practice we don't
  // need to consume the invite at this step: it was tracked at step 1
  // by usedBy (no, we didn't set that). To keep step 2 self-sufficient
  // and idempotent, we MARK the user as email_verified without
  // consuming the invite here. The invite is consumed at step 3
  // (set-password, Phase 2) which is the "real" registration moment.
  //
  // Net effect: for now, the invite stays redeemable until step 3.
  // If the user abandons before step 3, the cleanup cron purges the
  // pre_register row after 24h and the invite stays available.
  const result = await db.transaction(async (tx) => {
    const updateResult = await tx
      .update(users)
      .set({
        emailVerifiedAt: new Date(),
        registerState: 'email_verified',
      })
      .where(
        and(
          eq(users.id, userId),
          eq(users.registerState, 'pre_register'),
        ),
      )
      .returning({ id: users.id, email: users.email, registerState: users.registerState });
    return updateResult[0] ?? null;
  });

  if (!result) {
    // The user was no longer in pre_register (race? cleanup? schema drift).
    // The verification is already consumed, so we can't replay; surface as
    // a generic failure. Step 1 will need to be redone.
    return c.json({ error: 'verification_failed', reason: 'no_pending_verification' }, 401);
  }

  // Emit register session cookie (24h, kind='register').
  const session = await createSession(userId, { kind: 'register' });
  await setRegisterCookie(c, session.id, session.expiresAt);

  const response: RegisterStateResponse = {
    userId: result.id,
    email: result.email,
    registerState: result.registerState,
  };
  return c.json(response);
});

/**
 * `GET /auth/register/state` — resume helper.
 *
 * Reads the register cookie, returns enough info for the client to
 * route to the correct step. Phase 1B always returns `email_verified`
 * since steps 3+ aren't wired yet — that bumps to richer state values
 * once Phase 2 ships.
 */
authRegisterV2Routes.get('/state', requireRegisterSession, (c) => {
  const user = c.get('registerUser');
  const response: RegisterStateResponse = {
    userId: user.id,
    email: user.email,
    registerState: user.registerState,
  };
  return c.json(response);
});

const setPasswordLimiter = rateLimit({
  max: 10,
  windowMs: 60 * 60_000,
  keyPrefix: 'register-set-password',
});

/**
 * `POST /auth/register/set-password` — Step 3 (transitional).
 *
 * Bridges the multi-step register flow to the legacy password-derived
 * crypto envelope. Replaced by OPAQUE in Phase 2 of Auth-Roadmap.
 *
 * Required: register cookie (kind='register'). The user is identified
 * via the cookie, so the body carries no email — only the password
 * (Argon2id-hashed server-side), the invite code (kept in client state
 * since step 1, consumed atomically here), and the encryption envelope
 * (`encryptionSalt` + `encryptedKey`) the client just produced by
 * wrapping a fresh main key under the password-derived KEK.
 *
 * On success the register session is replaced by a full session; the
 * client immediately calls `/auth/me` to populate the auth slice and
 * unwraps the main key locally.
 */
authRegisterV2Routes.post(
  '/set-password',
  setPasswordLimiter,
  requireRegisterSession,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = RegisterSetPasswordBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const body = parsed.data;
    const user = c.get('registerUser');
    const registerSessionId = c.get('registerSessionId');

    // Only `email_verified` users are allowed to set their password —
    // pre_register users haven't validated their email yet (impossible
    // path since /verify-email transitions them, but defensive).
    if (user.registerState !== 'email_verified') {
      return c.json({ error: 'invalid_state' }, 409);
    }

    const policy = checkPasswordPolicy(body.password, [user.email]);
    if (!policy.ok) {
      return c.json({ error: 'weak_password', reason: policy.reason }, 400);
    }

    const passwordHash = await hashPassword(body.password);
    const codeHash = hashInviteCode(body.inviteCode);
    const now = new Date();

    // Atomic: consume invite + complete user + replace session.
    const result = await db.transaction(async (tx) => {
      // 1. Lock the invite for update.
      const [invite] = await tx
        .select()
        .from(invites)
        .where(
          and(
            eq(invites.codeHash, codeHash),
            isNull(invites.usedBy),
            or(isNull(invites.expiresAt), gt(invites.expiresAt, now)),
          ),
        )
        .for('update')
        .limit(1);
      if (!invite) {
        return { ok: false as const, reason: 'invalid_invite' as const };
      }

      // 2. UPDATE the user: real crypto envelope + state=complete.
      //    The WHERE clause guards against a concurrent transition
      //    racing the row past 'email_verified'.
      const [updated] = await tx
        .update(users)
        .set({
          passwordHash,
          encryptionSalt: body.encryptionSalt,
          encryptedKey: body.encryptedKey,
          registerState: 'complete',
        })
        .where(
          and(eq(users.id, user.id), eq(users.registerState, 'email_verified')),
        )
        .returning({ id: users.id });
      if (!updated) {
        return { ok: false as const, reason: 'invalid_state' as const };
      }

      // 3. Consume the invite.
      await tx
        .update(invites)
        .set({ usedBy: user.id, usedAt: now })
        .where(eq(invites.id, invite.id));

      // 4. Drop the register session — the cookie that brought us here
      //    is about to be replaced by a full session cookie.
      await tx.delete(sessions).where(eq(sessions.id, registerSessionId));

      return { ok: true as const, userId: user.id };
    });

    if (!result.ok) {
      const status = result.reason === 'invalid_invite' ? 400 : 409;
      return c.json({ error: 'register_failed', reason: result.reason }, status);
    }

    // Outside the tx: emit the full session. Doing it inside would lock
    // the sessions row pointlessly, since the new session has a fresh id.
    const fullSession = await createSession(result.userId, { kind: 'full' });
    clearRegisterCookie(c);
    await setSessionCookie(c, fullSession.id, fullSession.expiresAt);

    return c.json({ id: result.userId });
  },
);
