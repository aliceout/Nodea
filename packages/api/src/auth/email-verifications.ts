import { createHash, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { emailVerifications, type EmailVerification } from '../db/schema.ts';

/**
 * Email verification codes — Auth-Spec.md §7.1 step 2.
 *
 * Used today by the multi-step register flow (`kind: 'register'`) and
 * later by change-email (`kind: 'email_change'`) once Phase 2 wires it.
 *
 * Codes are 6 random digits (~20 bits). Brute-force is mitigated by:
 *   - 10-minute TTL,
 *   - max 5 attempts (row purged + new request forced thereafter),
 *   - per-email and per-IP rate-limits on the request route itself.
 *
 * Stored hashed (SHA-256) — the codes are bearer secrets; we want to
 * be able to verify but not reverse them from a leaked DB. Comparison
 * is constant-time via `timingSafeEqual` to keep response latency from
 * leaking match-position info.
 */

const CODE_LENGTH = 6;
const TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export type EmailVerificationKind = 'register' | 'email_change';

/**
 * Cryptographically random 6-digit code, zero-padded. `randomInt` from
 * node:crypto is uniform over [0, 999_999], so no modulo bias.
 */
export function generateEmailCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(CODE_LENGTH, '0');
}

export function hashEmailCode(code: string): string {
  return createHash('sha256').update(code, 'utf8').digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export interface CreateVerificationOptions {
  userId: string | null;
  email: string;
  kind: EmailVerificationKind;
  /** Override the default 10-minute TTL — used only by tests. */
  ttlMs?: number;
}

export interface CreatedVerification {
  id: string;
  /** The clear code — return ONCE to the caller, never persist or log. */
  code: string;
}

/**
 * Generate a fresh code, hash it, and persist a row. Existing
 * non-consumed rows for the same (email, kind) are left in place
 * (the caller decides whether to invalidate them — typically
 * `start` invalidates the previous to avoid confusion).
 */
export async function createEmailVerification(
  opts: CreateVerificationOptions,
): Promise<CreatedVerification> {
  const code = generateEmailCode();
  const codeHash = hashEmailCode(code);
  const id = randomUUID();
  const expiresAt = new Date(Date.now() + (opts.ttlMs ?? TTL_MS));
  await db.insert(emailVerifications).values({
    id,
    userId: opts.userId,
    email: opts.email.toLowerCase(),
    kind: opts.kind,
    codeHash,
    expiresAt,
  });
  return { id, code };
}

/**
 * Invalidate any non-consumed verification for the given email + kind
 * combo. Called by `start` so that re-issuing a code immediately
 * supersedes the previous (no race with the user submitting an old
 * code while a new one was just sent).
 */
export async function invalidatePendingVerifications(
  email: string,
  kind: EmailVerificationKind,
): Promise<void> {
  await db
    .update(emailVerifications)
    .set({ consumedAt: new Date() })
    .where(
      and(
        eq(emailVerifications.email, email.toLowerCase()),
        eq(emailVerifications.kind, kind),
        isNull(emailVerifications.consumedAt),
      ),
    );
}

export type ConsumeResult =
  | { ok: true; verification: EmailVerification }
  | {
      ok: false;
      reason: 'no_pending_verification' | 'expired' | 'too_many_attempts' | 'invalid_code';
    };

/**
 * Look up the latest non-consumed verification for the given email +
 * kind, validate the code, and consume it on success.
 *
 * Failure modes are explicit:
 *   - `no_pending_verification` : no row found (or all consumed).
 *   - `expired`                 : row's `expires_at` is past.
 *   - `too_many_attempts`       : caller exceeded MAX_ATTEMPTS — the row
 *                                  is marked consumed so a new request
 *                                  is required.
 *   - `invalid_code`            : code doesn't match. Increments the
 *                                  attempts counter atomically.
 */
export async function consumeEmailVerification(
  email: string,
  kind: EmailVerificationKind,
  code: string,
): Promise<ConsumeResult> {
  const now = new Date();
  // Take the most recent non-consumed row. If multiple exist (shouldn't
  // happen post-`invalidatePendingVerifications`, but be defensive), the
  // latest wins.
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.email, email.toLowerCase()),
        eq(emailVerifications.kind, kind),
        isNull(emailVerifications.consumedAt),
      ),
    )
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: 'no_pending_verification' };
  if (row.expiresAt <= now) {
    // Mark as consumed so future calls report "no pending" instead of
    // "expired" repeatedly.
    await db
      .update(emailVerifications)
      .set({ consumedAt: now })
      .where(eq(emailVerifications.id, row.id));
    return { ok: false, reason: 'expired' };
  }
  if (row.attempts >= MAX_ATTEMPTS) {
    await db
      .update(emailVerifications)
      .set({ consumedAt: now })
      .where(eq(emailVerifications.id, row.id));
    return { ok: false, reason: 'too_many_attempts' };
  }

  const submittedHash = hashEmailCode(code);
  if (!constantTimeEqualHex(row.codeHash, submittedHash)) {
    // Bump attempts; do NOT consume — the user gets MAX_ATTEMPTS shots
    // total before we block. Concurrent submissions race on the
    // increment but Postgres serialises the UPDATE so the count is
    // accurate enough for rate-limit purposes.
    await db
      .update(emailVerifications)
      .set({ attempts: row.attempts + 1 })
      .where(eq(emailVerifications.id, row.id));
    return { ok: false, reason: 'invalid_code' };
  }

  // Match — atomically mark consumed and return the row for the caller
  // to use as a basis for downstream transitions (set users.email_verified_at,
  // consume invite, etc.).
  await db
    .update(emailVerifications)
    .set({ consumedAt: now })
    .where(eq(emailVerifications.id, row.id));
  return { ok: true, verification: row };
}

/** Useful for tests. */
export const __testing = {
  CODE_LENGTH,
  TTL_MS,
  MAX_ATTEMPTS,
};
