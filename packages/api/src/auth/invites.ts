import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import { and, eq, gt, isNull, or } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { invites } from '../db/schema.ts';

/**
 * Email-bound invite tokens (Bitwarden-style).
 *
 * Lifecycle:
 *   1. Admin issues an invite for a specific email via
 *      `POST /admin/invites { email }`.
 *   2. Server generates a 32-byte random token, hashes it (SHA-256),
 *      stores `(email, code_hash)` and emails the recipient a link
 *      of the form `/register?invite=<clear_token>`.
 *   3. The recipient clicks the link → register page pre-fills email
 *      (read-only, locked to the invite) → user sets a password.
 *   4. Submission validates the invite, enforces strict email match,
 *      consumes the invite atomically, creates the user account
 *      already activated (the email click proved control).
 *
 * Tokens carry ~256 bits of entropy — far beyond brute-force range —
 * so we don't need an attempts counter on validation. Single-use:
 * `used_by` + `used_at` are set on first successful consumption.
 */

const TOKEN_BYTES = 32;
/** Default 7 days, can be overridden per invite via the admin form. */
const DEFAULT_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function generateInviteToken(): string {
  return randomBytes(TOKEN_BYTES).toString('base64url');
}

export function hashInviteToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

function constantTimeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export interface CreateInviteOptions {
  email: string;
  createdBy?: string | undefined;
  /** Override the default 7-day TTL — used by tests + admin power users. */
  expiresAt?: Date | undefined;
}

export interface CreatedInvite {
  id: string;
  /** Clear token to embed in the invite link. Returned ONCE; never
   *  persisted, never logged. */
  token: string;
  email: string;
  expiresAt: Date;
}

/**
 * Provision a fresh invite for an email. Caller (admin route) is
 * responsible for sending the actual invitation email after this
 * resolves.
 */
export async function createInvite(opts: CreateInviteOptions): Promise<CreatedInvite> {
  const token = generateInviteToken();
  const codeHash = hashInviteToken(token);
  const id = randomUUID();
  const email = opts.email.toLowerCase();
  const expiresAt = opts.expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MS);

  const values: typeof invites.$inferInsert = {
    id,
    email,
    codeHash,
    expiresAt,
  };
  if (opts.createdBy !== undefined) values.createdBy = opts.createdBy;

  await db.insert(invites).values(values);
  return { id, token, email, expiresAt };
}

export interface ValidInviteInfo {
  id: string;
  email: string;
  expiresAt: Date | null;
}

/**
 * Look up an invite by its clear token, validating expiry + non-use.
 * Returns the email + id if valid, or null otherwise. Used by the
 * register-page invite-info endpoint to pre-fill the form.
 *
 * No timing-safety on the lookup itself: the indexed `code_hash`
 * comparison is constant-time enough at the SQL layer for our threat
 * model (the token has 256 bits, an attacker probing has nothing
 * sub-second to learn). The hash compare via `timingSafeEqual` runs
 * post-row-fetch as defense-in-depth.
 */
export async function findValidInvite(token: string): Promise<ValidInviteInfo | null> {
  const codeHash = hashInviteToken(token);
  const now = new Date();
  const [row] = await db
    .select()
    .from(invites)
    .where(
      and(
        eq(invites.codeHash, codeHash),
        isNull(invites.usedBy),
        or(isNull(invites.expiresAt), gt(invites.expiresAt, now)),
      ),
    )
    .limit(1);

  if (!row) return null;
  if (!constantTimeEqualHex(row.codeHash, codeHash)) return null;
  return { id: row.id, email: row.email, expiresAt: row.expiresAt };
}

/**
 * Atomically consume an invite token and create the associated user.
 * Used by the register submit route when the user holds an invite.
 *
 * The whole operation runs inside a single transaction with
 * `SELECT … FOR UPDATE` so two parallel registrations on the same
 * token cannot both succeed. On any error from `createUser`
 * (uniqueness, weak password caught downstream, …) the tx rolls
 * back and the invite stays redeemable.
 *
 * Strict email match is enforced HERE, not by the caller — the
 * recipient must register with EXACTLY the email the admin invited.
 */
export type ConsumeInviteFailureReason =
  | 'invalid_token'
  | 'email_mismatch';

export async function consumeInviteAndCreateUser<T>(
  token: string,
  email: string,
  createUser: (
    tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  ) => Promise<{ userId: string; result: T }>,
): Promise<
  | { ok: true; result: T }
  | { ok: false; reason: ConsumeInviteFailureReason }
> {
  const codeHash = hashInviteToken(token);
  const targetEmail = email.toLowerCase();
  const now = new Date();

  return db.transaction(async (tx) => {
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

    if (!invite) return { ok: false as const, reason: 'invalid_token' };
    if (!constantTimeEqualHex(invite.codeHash, codeHash)) {
      return { ok: false as const, reason: 'invalid_token' };
    }
    if (invite.email.toLowerCase() !== targetEmail) {
      return { ok: false as const, reason: 'email_mismatch' };
    }

    const { userId, result } = await createUser(tx);

    await tx
      .update(invites)
      .set({ usedBy: userId, usedAt: now })
      .where(eq(invites.id, invite.id));

    return { ok: true as const, result };
  });
}
