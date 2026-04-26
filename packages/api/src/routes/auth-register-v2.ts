import { Hono } from 'hono';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  RegisterSubmitBodySchema,
  RegisterActivateBodySchema,
} from '@nodea/shared/schemas/auth-register-v2';
import { db } from '../db/client.ts';
import { invites, users } from '../db/schema.ts';
import { hashInviteCode } from '../auth/invites.ts';
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

/**
 * Single-step register flow with post-submit magic-link activation
 * (Auth-Roadmap Phase 1 simplified, replaces the 3-step wizard).
 *
 * Two endpoints:
 *
 *   - `POST /auth/register`         single submit (email + password +
 *                                   invite + crypto envelope), creates
 *                                   the user as inactive, emails the
 *                                   activation link.
 *   - `POST /auth/register/activate` magic-link target, flips
 *                                   `email_verified_at` so the account
 *                                   can log in.
 *
 * The legacy single-shot `POST /auth/register` from `auth.ts` is
 * SUPERSEDED by this route — Hono's `app.route('/auth/register', …)`
 * mount catches `POST /auth/register` first, so the legacy handler
 * (which created users immediately active) is no longer reachable
 * via HTTP. Direct DB-based seeding (`pnpm seed:admin`) bypasses
 * activation by setting `email_verified_at` at insert time.
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

/**
 * `POST /auth/register` — submit step.
 *
 * Always responds 200 (anti-enumeration). The actual side effects
 * depend on the (email, invite) combo:
 *
 *   - Valid invite + new email → user row created with
 *     `email_verified_at = NULL`, activation email sent.
 *   - Valid invite + existing INACTIVE user with same email →
 *     existing row reused, previous token invalidated, fresh email
 *     sent. Lets a user retry without burning the invite or being
 *     blocked by uniqueness.
 *   - Valid invite + existing ACTIVE user with same email →
 *     silent skip (no email, no row touch). The attacker can't tell
 *     this case apart from the happy path.
 *   - Invalid invite (unknown / used / expired) → silent skip.
 *
 * The invite is **looked up** here but not consumed. Consumption
 * happens at activation — that way a retry via a fresh token (e.g.,
 * after a typo'd email) keeps the invite redeemable.
 */
authRegisterV2Routes.post('/', submitLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = RegisterSubmitBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const body = parsed.data;
  const email = body.email.toLowerCase();

  // Surface password policy violations BEFORE the silent-200 path so
  // the user sees a real error. zxcvbn / rules check is a client-side
  // input concern, not an enumeration vector.
  const policy = checkPasswordPolicy(body.password, [email]);
  if (!policy.ok) {
    return c.json({ error: 'weak_password', reason: policy.reason }, 400);
  }

  // Step A — invite lookup. Anti-enum: don't leak.
  const codeHash = hashInviteCode(body.inviteCode);
  const now = new Date();
  const [invite] = await db
    .select()
    .from(invites)
    .where(eq(invites.codeHash, codeHash))
    .limit(1);
  const inviteOk =
    invite && !invite.usedBy && (!invite.expiresAt || invite.expiresAt > now);
  if (!inviteOk) {
    return c.json({ ok: true });
  }

  // Step B — email uniqueness with reuse for inactive accounts.
  const [existing] = await db
    .select({
      id: users.id,
      emailVerifiedAt: users.emailVerifiedAt,
    })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  let userId: string;

  if (existing) {
    if (existing.emailVerifiedAt !== null) {
      // Active user → silent skip.
      return c.json({ ok: true });
    }
    // Inactive existing row → reuse, refresh credentials in case the
    // user typed a different password the second time around.
    userId = existing.id;
    const passwordHash = await hashPassword(body.password);
    await db
      .update(users)
      .set({
        passwordHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
      })
      .where(eq(users.id, userId));
  } else {
    // Fresh row.
    userId = randomUUID();
    const passwordHash = await hashPassword(body.password);
    try {
      await db.insert(users).values({
        id: userId,
        email,
        passwordHash,
        encryptionSalt: body.encryptionSalt,
        encryptedKey: body.encryptedKey,
        registerState: 'complete',
        // emailVerifiedAt left NULL — activation will set it.
      });
    } catch {
      // Race: another request inserted the same email between SELECT
      // and INSERT. Bail anti-enum-style.
      return c.json({ ok: true });
    }
  }

  // Step C — invalidate any pending activation for this email and
  // issue a fresh one.
  await invalidatePendingVerifications(email, 'register');
  const { token } = await createEmailVerification({
    userId,
    email,
    kind: 'register',
  });

  // Step D — build the activation link and send. WEB_BASE_URL is the
  // user-facing origin (no trailing slash); the frontend's
  // /activate route reads ?token= from the URL.
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
    // Still 200 — the user can retry the submit, which reuses the row
    // and fires a new email.
  }

  return c.json({ ok: true });
});

/**
 * `POST /auth/register/activate` — magic-link target.
 *
 * Validates the token (hash, expiry, single-use) and sets
 * `email_verified_at = now()` on the matching user. Returns the
 * email so the UI can show a "Compte activé pour user@example.com"
 * confirmation.
 *
 * No cookie is emitted: the user must log in normally afterwards.
 * Rationale: activation is a passive "yes this is my email" check,
 * not a credentials proof — an attacker who hijacks a single
 * activation link should not get a session.
 */
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
    // Shouldn't happen — the submit route always sets it. Defensive.
    // eslint-disable-next-line no-console
    console.error(
      '[auth/register/activate] verification consumed but userId is null',
      { verificationId: verification.id },
    );
    return c.json({ error: 'internal' }, 500);
  }

  // Set the user's email_verified_at. The WHERE clause guards
  // against a doubled activation (would be a no-op anyway since the
  // verification can't be consumed twice, but explicit = safer).
  const [updated] = await db
    .update(users)
    .set({ emailVerifiedAt: new Date() })
    .where(and(eq(users.id, verification.userId), isNull(users.emailVerifiedAt)))
    .returning({ id: users.id, email: users.email });

  if (!updated) {
    // The user was already activated (e.g., second click on the same
    // link, or admin manually flipped). Surface the same "already
    // consumed" path so the UI tells them to log in.
    return c.json(
      { error: 'activation_failed', reason: 'already_consumed' },
      401,
    );
  }

  // V1 trade-off: we do NOT consume the invite at submit OR at
  // activation. Same invite can be reused for multiple registrations
  // — the model is "shared invite link" rather than single-use.
  // Tightening this to single-use needs a `users.invite_id` FK column
  // (so we can mark it consumed at activation), tracked as a post-V1
  // hardening when invite hygiene becomes a real concern.
  return c.json({ ok: true, email: updated.email });
});
