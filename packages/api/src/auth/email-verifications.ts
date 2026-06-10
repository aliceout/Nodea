import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { emailVerifications, type EmailVerification } from '../db/schema.ts';

/**
 * Magic-link tokens for the post-submit account activation flow
 * (Auth-Roadmap Phase 1, docs/auth/Register.md simplified) and for the
 * upcoming change-email flow (`kind: 'email_change'`).
 *
 * Tokens are 32 random bytes encoded as base64url (~256 bits) — well
 * beyond brute-force range, so we don't need an attempts counter.
 * Stored as SHA-256 of the bytes; verification is constant-time. Each
 * row is single-use: `consumed_at` is set on first successful match.
 *
 * The table is the same `email_verifications` from Phase 1B/1C; only
 * the semantic of `code_hash` changed (was a 6-digit code hash, now a
 * full token hash). The schema didn't move so no migration is needed.
 */

const TOKEN_BYTES = 32;
/** Activation links stay valid for a week — long enough to land in
 *  spam folders, get found, and clicked, without keeping rows around
 *  forever. The cleanup cron purges expired rows + deletes any
 *  associated unactivated user (Auth-Spec §13.2). */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type EmailVerificationKind = 'register' | 'email_change';

/**
 * Generate a cryptographically random token + base64url-encode it for
 * URL safety. The clear value is returned ONCE to the caller (to drop
 * into the email link); only its hash hits the DB.
 */
export function generateToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    // `Buffer.from(_, 'hex')` returns truncated bytes on malformed
    // input ; `timingSafeEqual` then throws if lengths mismatch.
    // Either way the input wasn't a valid hex pair, so the answer
    // is "not equal".
    return false;
  }
}

export interface CreateTokenOptions {
  userId: string | null;
  email: string;
  kind: EmailVerificationKind;
  /** Override the default TTL — used only by tests. */
  ttlMs?: number;
}

export interface CreatedToken {
  id: string;
  /** Clear token — deliver in the email link, never persist or log. */
  token: string;
}

export async function createEmailVerification(
  opts: CreateTokenOptions,
): Promise<CreatedToken> {
  const token = generateToken();
  const codeHash = hashToken(token);
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
  return { id, token };
}

/**
 * Mark every non-consumed verification for the given email + kind as
 * consumed. Called by `submit` so a fresh activation request
 * supersedes an earlier unclicked one without race risk.
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
      reason: 'invalid_token' | 'expired' | 'already_consumed';
    };

/**
 * Validate a magic-link token + consume it on success.
 *
 * The flow is symmetric whether the token is for activation or for a
 * future email-change flow: hash the supplied token, look up the row,
 * timing-safe compare, and consume. We deliberately don't return
 * structural details on `invalid_token` — an attacker spraying random
 * tokens cannot tell whether they got close.
 */
export async function consumeEmailVerification(
  kind: EmailVerificationKind,
  token: string,
): Promise<ConsumeResult> {
  const tokenHash = hashToken(token);
  const now = new Date();

  // Match the hash directly. With 256 bits of entropy collisions are
  // not a concern. `code_hash` is now indexed
  // (`email_verifications_code_hash_idx`, audit 2026-06 passe 2), so
  // this lookup is index-backed rather than the prior sequential scan ;
  // the `kind` equality further narrows the candidate set. The cleanup
  // cron still purges expired/consumed rows weekly, keeping it small.
  const [row] = await db
    .select()
    .from(emailVerifications)
    .where(
      and(
        eq(emailVerifications.kind, kind),
        eq(emailVerifications.codeHash, tokenHash),
      ),
    )
    .orderBy(desc(emailVerifications.createdAt))
    .limit(1);

  if (!row) return { ok: false, reason: 'invalid_token' };
  if (!constantTimeEqualHex(row.codeHash, tokenHash)) {
    return { ok: false, reason: 'invalid_token' };
  }
  if (row.consumedAt !== null) {
    return { ok: false, reason: 'already_consumed' };
  }
  if (row.expiresAt <= now) {
    return { ok: false, reason: 'expired' };
  }

  // Conditional consume — `consumed_at IS NULL` in the WHERE plus a
  // row-count check, so two concurrent calls with the same token
  // can't both pass the in-memory check above and double-consume
  // (audit 2026-06 ; harmless for `register` thanks to the
  // idempotent activation UPDATE, but the primitive must hold for
  // future kinds like `email_change`).
  const updated = await db
    .update(emailVerifications)
    .set({ consumedAt: now })
    .where(
      and(
        eq(emailVerifications.id, row.id),
        isNull(emailVerifications.consumedAt),
      ),
    )
    .returning({ id: emailVerifications.id });
  if (updated.length === 0) {
    return { ok: false, reason: 'already_consumed' };
  }
  return { ok: true, verification: row };
}

export const __testing = {
  TOKEN_BYTES,
  TTL_MS,
};
