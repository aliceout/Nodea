import { randomBytes, createHash, randomUUID } from 'node:crypto';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { passwordResetTokens, type PasswordResetToken } from '../db/schema.ts';

const TOKEN_BYTES = 32;
const TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

/**
 * Mint a new reset token, store its SHA-256 hash, and return the
 * clear token to the caller (sent by email, never persisted).
 *
 * Minting supersedes every previous outstanding token for the same
 * user — only the most recently emailed link works. Two « mot de
 * passe oublié » requests used to leave two live tokens in
 * parallel (audit 2026-06) ; `/reset/finish` additionally
 * invalidates all remaining tokens on success as a second layer.
 */
export async function createResetToken(userId: string): Promise<{ id: string; token: string }> {
  const token = randomBytes(TOKEN_BYTES).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const id = randomUUID();
  await db.transaction(async (tx) => {
    await tx
      .update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(
        and(
          eq(passwordResetTokens.userId, userId),
          isNull(passwordResetTokens.usedAt),
        ),
      );
    await tx.insert(passwordResetTokens).values({
      id,
      userId,
      tokenHash,
      expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
    });
  });
  return { id, token };
}

/**
 * Look up an unconsumed, unexpired reset token. Returns the row so
 * the caller can run its side effects in a transaction keyed on the
 * token id.
 */
export async function findActiveResetToken(token: string): Promise<PasswordResetToken | null> {
  const tokenHash = createHash('sha256').update(token).digest('hex');
  const now = new Date();
  const [row] = await db
    .select()
    .from(passwordResetTokens)
    .where(
      and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        isNull(passwordResetTokens.usedAt),
        gt(passwordResetTokens.expiresAt, now),
      ),
    )
    .limit(1);
  return row ?? null;
}
