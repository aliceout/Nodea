import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import {
  TotpEnrollStartBodySchema,
  TotpEnrollVerifyBodySchema,
  TotpManagementBodySchema,
  type TotpEnrollStartResponse,
  type TotpRegenerateBackupCodesResponse,
} from '@nodea/shared';
import { db } from '../db/client.ts';
import { mfaTotp, mfaTotpRecoveryCodes, users } from '../db/schema.ts';
import {
  buildTotpUri,
  currentWindow,
  generateTotpSecret,
  verifyTotpCode,
} from '../auth/totp.ts';
import {
  generateBackupCodes,
  hashBackupCode,
  normaliseBackupCode,
  BACKUP_CODES_PER_USER,
} from '../auth/totp-backup-codes.ts';
import { getEmailService } from '../services/email/index.ts';
import { renderSecurityModeDowngradedEmail } from '../services/email/templates/security-mode-downgraded.ts';
import { rateLimit } from '../middleware/rate-limit.ts';
import { requireUser, type AuthVariables } from '../middleware/require-user.ts';
import { requireFreshPassword } from '../middleware/require-fresh-reauth.ts';

/**
 * TOTP routes (Auth-Roadmap Phase 5B, Auth-Spec §8).
 *
 * Four authenticated routes for the management surface (Settings):
 *
 *   - `POST /auth/totp/enroll/start`  (password proof) — generates a
 *     fresh secret + 10 backup codes, persists with `enabled_at:
 *     NULL` so a user who abandons mid-flow doesn't end up with TOTP
 *     "active" without verification.
 *   - `POST /auth/totp/enroll/verify` (auth) — verifies a code against
 *     the pending secret + the backup-codes ack flag, flips
 *     `enabled_at = now()`.
 *   - `POST /auth/totp/disable` (password proof) — wipes `enabled_at`
 *     + DELETEs all backup codes; downgrades `security_mode` to
 *     `password_or_passkey` if it was set to `always_totp`/`maximum`
 *     (§6.1 downgrade auto).
 *   - `POST /auth/totp/backup-codes/regenerate` (password proof) —
 *     DELETE old backup codes + INSERT 10 fresh ones in a transaction.
 *     Refuses if TOTP isn't enabled (would be regenerating into a
 *     dead pool).
 *
 * Stepped MFA at login (§7.4) is delivered in Phase 5C — these
 * routes are scoped to a session-full caller acting on their own
 * TOTP record.
 */
export const authTotpRoutes = new Hono<{ Variables: AuthVariables }>();

const enrollLimiter = rateLimit({
  max: 10,
  windowMs: 15 * 60_000,
  keyPrefix: 'totp-enroll',
});

const manageLimiter = rateLimit({
  max: 30,
  windowMs: 15 * 60_000,
  keyPrefix: 'totp-manage',
});

/* ============================================================================
 * POST /auth/totp/enroll/start
 *
 * Re-auth gate: `requireFreshPassword` (Phase 7B). Pre-7B the body
 * carried an embedded OPAQUE proof; that's now done out-of-band
 * via `POST /auth/reauth/password`.
 * ========================================================================== */

authTotpRoutes.post(
  '/totp/enroll/start',
  requireUser,
  requireFreshPassword,
  enrollLimiter,
  async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = TotpEnrollStartBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  // Generate a fresh secret + 10 backup codes. We persist both BEFORE
  // returning to the client so a network drop after this call leaves
  // the server in a coherent "pending enrollment" state instead of
  // a phantom secret the client knows but the server doesn't.
  const secret = generateTotpSecret();
  const backupCodes = generateBackupCodes();
  const backupCodeHashes = backupCodes.map((code) => {
    const normalised = normaliseBackupCode(code);
    if (normalised === null) {
      // Should never happen — we just generated these codes ourselves
      // through `generateBackupCode`, which always emits valid base32.
      throw new Error('generateBackupCodes produced an invalid code');
    }
    return hashBackupCode(normalised);
  });

  await db.transaction(async (tx) => {
    // UPSERT into mfa_totp: a user who started enrollment, abandoned,
    // and starts again gets a fresh pending secret. The `enabled_at`
    // is null until /verify so the row is identifiable as pending.
    await tx
      .insert(mfaTotp)
      .values({
        userId: user.id,
        secret,
        algo: 'SHA1',
        digits: 6,
        period: 30,
        enabledAt: null,
        lastWindow: null,
      })
      .onConflictDoUpdate({
        target: mfaTotp.userId,
        set: {
          secret,
          algo: 'SHA1',
          digits: 6,
          period: 30,
          enabledAt: null,
          lastWindow: null,
        },
      });

    // Replace any prior backup codes (a previous abandoned enrollment
    // shouldn't bleed its codes into the new attempt).
    await tx
      .delete(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, user.id));
    await tx.insert(mfaTotpRecoveryCodes).values(
      backupCodeHashes.map((codeHash) => ({
        id: randomUUID(),
        userId: user.id,
        codeHash,
        usedAt: null,
      })),
    );
  });

  const response: TotpEnrollStartResponse = {
    secretBase32: secret,
    otpauthUri: buildTotpUri(secret),
    backupCodes,
  };
  return c.json(response);
});

/* ============================================================================
 * POST /auth/totp/enroll/verify
 * ========================================================================== */

authTotpRoutes.post('/totp/enroll/verify', requireUser, enrollLimiter, async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = TotpEnrollVerifyBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');
  const { code, backupCodesAcknowledged } = parsed.data;

  // Hard gate from Auth-Spec §8.2 — refuse to flip enabled_at if the
  // user hasn't ticked the ack checkbox client-side. Zod has already
  // narrowed this to `true` literal but we keep the check explicit so
  // the failure mode reads at the route level.
  if (!backupCodesAcknowledged) {
    return c.json({ error: 'backup_codes_unacknowledged' }, 400);
  }

  const [pending] = await db
    .select()
    .from(mfaTotp)
    .where(eq(mfaTotp.userId, user.id))
    .limit(1);
  if (!pending) return c.json({ error: 'no_pending_enrollment' }, 400);
  if (pending.enabledAt !== null) {
    return c.json({ error: 'already_enabled' }, 409);
  }

  const result = await verifyTotpCode(pending.secret, code);
  if (!result.valid) return c.json({ error: 'invalid_code' }, 401);

  // Anti-replay: stash the matched window so a code from this same
  // window can't be replayed. Auth-Spec §8.3.
  //
  // Auto-promote `security_mode` from `password_or_passkey` to
  // `always_totp` in the same transaction: a user who just went
  // through TOTP enrollment expects it to be enforced on the next
  // login (otherwise the activation is a no-op). Modes already at
  // `always_totp` / `maximum` stay where they are.
  const enabledAt = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(mfaTotp)
      .set({
        enabledAt,
        lastWindow: result.window,
      })
      .where(eq(mfaTotp.userId, user.id));
    if (user.securityMode === 'password_or_passkey') {
      await tx
        .update(users)
        .set({ securityMode: 'always_totp', updatedAt: enabledAt })
        .where(eq(users.id, user.id));
    }
  });

  return c.json({ ok: true, enabledAt: enabledAt.toISOString() });
});

/* ============================================================================
 * POST /auth/totp/disable
 * ========================================================================== */

authTotpRoutes.post(
  '/totp/disable',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
  const raw = await c.req.json().catch(() => null);
  const parsed = TotpManagementBodySchema.safeParse(raw);
  if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
  const user = c.get('user');

  const downgradedFrom: 'always_totp' | 'maximum' | null =
    user.securityMode === 'always_totp' || user.securityMode === 'maximum'
      ? user.securityMode
      : null;

  await db.transaction(async (tx) => {
    // Delete the row entirely (cleaner than nulling enabled_at —
    // re-enrollment goes through /enroll/start which UPSERTs a fresh
    // secret).
    await tx.delete(mfaTotp).where(eq(mfaTotp.userId, user.id));
    await tx
      .delete(mfaTotpRecoveryCodes)
      .where(eq(mfaTotpRecoveryCodes.userId, user.id));

    // §6.1 downgrade auto: a user disabling TOTP while in a mode
    // that requires it falls back to `password_or_passkey` in the
    // same transaction.
    if (downgradedFrom) {
      await tx
        .update(users)
        .set({ securityMode: 'password_or_passkey', updatedAt: new Date() })
        .where(eq(users.id, user.id));
    }
  });

  if (downgradedFrom) {
    // Best-effort notification — disable just succeeded server-side,
    // an SMTP hiccup must not turn the route into a 5xx.
    try {
      const rendered = renderSecurityModeDowngradedEmail({
        trigger: 'totp_disabled',
        previousMode: downgradedFrom,
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
         
        console.warn('[auth/totp] downgrade notification mail failed', err);
      }
    }
  }

  return c.json({ ok: true });
});

/* ============================================================================
 * POST /auth/totp/backup-codes/regenerate
 * ========================================================================== */

authTotpRoutes.post(
  '/totp/backup-codes/regenerate',
  requireUser,
  requireFreshPassword,
  manageLimiter,
  async (c) => {
    const raw = await c.req.json().catch(() => null);
    const parsed = TotpManagementBodySchema.safeParse(raw);
    if (!parsed.success) return c.json({ error: 'invalid_body' }, 400);
    const user = c.get('user');

    // Refuse to regen into a dead pool — TOTP must be fully enabled.
    const [totp] = await db
      .select({ enabledAt: mfaTotp.enabledAt })
      .from(mfaTotp)
      .where(eq(mfaTotp.userId, user.id))
      .limit(1);
    if (!totp || totp.enabledAt === null) {
      return c.json({ error: 'totp_not_enabled' }, 400);
    }

    const backupCodes = generateBackupCodes();
    const backupCodeHashes = backupCodes.map((code) => {
      const normalised = normaliseBackupCode(code);
      if (normalised === null) {
        throw new Error('generateBackupCodes produced an invalid code');
      }
      return hashBackupCode(normalised);
    });

    await db.transaction(async (tx) => {
      await tx
        .delete(mfaTotpRecoveryCodes)
        .where(eq(mfaTotpRecoveryCodes.userId, user.id));
      await tx.insert(mfaTotpRecoveryCodes).values(
        backupCodeHashes.map((codeHash) => ({
          id: randomUUID(),
          userId: user.id,
          codeHash,
          usedAt: null,
        })),
      );
    });

    const response: TotpRegenerateBackupCodesResponse = { backupCodes };
    return c.json(response);
  },
);

// `currentWindow` + `BACKUP_CODES_PER_USER` are imported because
// future Phase 5C consumers will lean on them; reference once to
// keep eslint quiet until that lands.
void currentWindow;
void BACKUP_CODES_PER_USER;
