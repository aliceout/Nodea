import { randomBytes, createHash, timingSafeEqual, randomUUID } from 'node:crypto';
import { and, eq, isNull, or, gt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { invites } from '../db/schema.ts';

/**
 * Invite code shape.
 *
 * - Clear code: `nd-<24 base32 chars>` (~120 bits of entropy) — emailed /
 *   given to the recipient, never stored server-side in clear.
 * - Stored hash: SHA-256 of the clear code. Invite codes are high-entropy
 *   bearer tokens, not passwords — argon2 is unnecessary and would slow
 *   registration for no meaningful gain. A plain cryptographic hash suffices
 *   against rainbow-table / enumeration attacks on the code_hash column.
 *
 * Verification uses a timing-safe comparison to avoid leaking existence via
 * response latency.
 */

const CODE_PREFIX = 'nd-';
const CODE_BYTES = 15;

function encodeBase32(buf: Buffer): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  let bits = 0;
  let value = 0;
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    out += alphabet[(value << (5 - bits)) & 31];
  }
  return out;
}

export function generateInviteCode(): string {
  return CODE_PREFIX + encodeBase32(randomBytes(CODE_BYTES));
}

export function hashInviteCode(code: string): string {
  return createHash('sha256').update(code.trim().toLowerCase()).digest('hex');
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
  createdBy?: string | undefined;
  expiresAt?: Date | undefined;
}

export async function createInvite(opts: CreateInviteOptions = {}): Promise<{ id: string; code: string }> {
  const code = generateInviteCode();
  const codeHash = hashInviteCode(code);
  const id = randomUUID();
  const values: typeof invites.$inferInsert = { id, codeHash };
  if (opts.createdBy !== undefined) values.createdBy = opts.createdBy;
  if (opts.expiresAt !== undefined) values.expiresAt = opts.expiresAt;
  await db.insert(invites).values(values);
  return { id, code };
}

export interface ConsumeInviteResult {
  ok: boolean;
  inviteId?: string;
  reason?: 'not_found' | 'already_used' | 'expired';
}

/**
 * Atomically consume an invite and create the associated user. The whole
 * operation runs inside a single transaction with `SELECT ... FOR UPDATE`
 * so two concurrent requests cannot redeem the same code.
 *
 * The caller provides a `createUser` function that receives the tx handle
 * and performs the INSERT into `users`, returning the new user id. On any
 * error (policy violation, duplicate email, etc.) the whole tx is rolled
 * back and the invite remains redeemable.
 */
export async function consumeInviteAndCreateUser<T>(
  code: string,
  createUser: (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => Promise<{ userId: string; result: T }>,
): Promise<{ ok: true; result: T } | { ok: false; reason: ConsumeInviteResult['reason'] }> {
  const codeHash = hashInviteCode(code);
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

    if (!invite) return { ok: false as const, reason: 'not_found' };

    // Extra defence-in-depth: verify the hash constant-time, not only via the
    // indexed WHERE clause (which already relied on equality).
    if (!constantTimeEqualHex(invite.codeHash, codeHash)) {
      return { ok: false as const, reason: 'not_found' };
    }

    const { userId, result } = await createUser(tx);

    await tx
      .update(invites)
      .set({ usedBy: userId, usedAt: now })
      .where(eq(invites.id, invite.id));

    return { ok: true as const, result };
  });
}
