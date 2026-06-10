import { randomUUID } from 'node:crypto';
import { describe, it, expect } from 'vitest';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.ts';
import {
  invites,
  mfaBypassRequests,
  passwordResetTokens,
} from '../db/schema.ts';
import { runCleanupExpiredTokens } from '../cron.ts';
import { seedUser } from './helpers.ts';

/**
 * Locks the keep / drop rules of the daily token-purge cron
 * (`runCleanupExpiredTokens`, audit 2026-06 passe 2). The subtle part
 * is what must SURVIVE : a redeemed invite (audit history) and an
 * in-flight MFA bypass request.
 */

const DAY = 24 * 60 * 60 * 1000;

describe('runCleanupExpiredTokens', () => {
  it('drops expired / used reset tokens, keeps live ones', async () => {
    const user = await seedUser('reset-purge@example.com');
    const expired = randomUUID();
    const used = randomUUID();
    const live = randomUUID();
    await db.insert(passwordResetTokens).values([
      {
        id: expired,
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() - DAY),
      },
      {
        id: used,
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + DAY),
        usedAt: new Date(Date.now() - 1000),
      },
      {
        id: live,
        userId: user.id,
        tokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + DAY),
      },
    ]);

    await runCleanupExpiredTokens();

    const remaining = await db
      .select({ id: passwordResetTokens.id })
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.userId, user.id));
    const ids = remaining.map((r) => r.id);
    expect(ids).toEqual([live]);
  });

  it('drops expired unredeemed invites, keeps redeemed + non-expiring', async () => {
    const redeemer = await seedUser('invite-keeper@example.com');
    const expiredOpen = randomUUID();
    const redeemed = randomUUID();
    const neverExpires = randomUUID();
    await db.insert(invites).values([
      {
        id: expiredOpen,
        email: 'expired-open@example.com',
        codeHash: randomUUID(),
        expiresAt: new Date(Date.now() - DAY),
      },
      {
        id: redeemed,
        email: 'redeemed@example.com',
        codeHash: randomUUID(),
        expiresAt: new Date(Date.now() - DAY),
        usedBy: redeemer.id,
        usedAt: new Date(Date.now() - DAY),
      },
      {
        id: neverExpires,
        email: 'eternal@example.com',
        codeHash: randomUUID(),
        expiresAt: null,
      },
    ]);

    await runCleanupExpiredTokens();

    const rows = await db.select({ id: invites.id }).from(invites);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(expiredOpen);
    expect(ids).toContain(redeemed);
    expect(ids).toContain(neverExpires);
  });

  it('drops terminal bypass requests, keeps an in-flight one', async () => {
    // One user per row : the `mfa_bypass_one_active` partial unique
    // index allows only a single non-terminal (cancelled_at IS NULL AND
    // consumed_at IS NULL) request per user, and an expired-but-not-
    // cancelled row still counts as non-terminal for that index — so
    // the expired and in-flight rows can't share a user.
    const uExpired = await seedUser('bypass-expired@example.com');
    const uConsumed = await seedUser('bypass-consumed@example.com');
    const uCancelled = await seedUser('bypass-cancelled@example.com');
    const uInFlight = await seedUser('bypass-inflight@example.com');
    const expired = randomUUID();
    const consumed = randomUUID();
    const cancelled = randomUUID();
    const inFlight = randomUUID();
    await db.insert(mfaBypassRequests).values([
      {
        id: expired,
        userId: uExpired.id,
        factor: 'totp',
        confirmTokenHash: randomUUID(),
        cancelTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() - DAY),
      },
      {
        id: consumed,
        userId: uConsumed.id,
        factor: 'totp',
        confirmTokenHash: randomUUID(),
        cancelTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + DAY),
        consumedAt: new Date(Date.now() - 1000),
      },
      {
        id: cancelled,
        userId: uCancelled.id,
        factor: 'totp',
        confirmTokenHash: randomUUID(),
        cancelTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + DAY),
        cancelledAt: new Date(Date.now() - 1000),
      },
      {
        id: inFlight,
        userId: uInFlight.id,
        factor: 'totp',
        confirmTokenHash: randomUUID(),
        cancelTokenHash: randomUUID(),
        expiresAt: new Date(Date.now() + DAY),
      },
    ]);

    await runCleanupExpiredTokens();

    const rows = await db
      .select({ id: mfaBypassRequests.id })
      .from(mfaBypassRequests);
    const ids = rows.map((r) => r.id);
    expect(ids).not.toContain(expired);
    expect(ids).not.toContain(consumed);
    expect(ids).not.toContain(cancelled);
    expect(ids).toContain(inFlight);
  });
});
