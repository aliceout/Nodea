import cron from 'node-cron';
import { and, eq, isNotNull, isNull, lt, notExists, or } from 'drizzle-orm';
import { db } from './db/client.ts';
import {
  emailVerifications,
  invites,
  mfaBypassRequests,
  passwordResetTokens,
  sessions,
  users,
} from './db/schema.ts';
import { getConfig } from './config.ts';

/**
 * Background cron jobs (Auth-Spec.md §13.2).
 *
 * Scheduled at server startup; each job runs in-process via
 * `node-cron`. Single-instance V1: when we scale to N replicas, move
 * to a dedicated worker or a Postgres-backed advisory-lock pattern
 * so jobs don't fire N times.
 *
 * Logging: each job prints a one-line summary so an oncall reading
 * stdout sees what was purged. Errors are logged but don't crash
 * the server — the next run picks up the slack.
 */

interface JobResult {
  /** Free-form name surfaced in the log line. */
  name: string;
  /** Counts to print, e.g. `{ users: 12, verifications: 18 }`. */
  counts: Record<string, number>;
}

let schedulerStarted = false;

/**
 * Idempotent registration entry point. Wires every job onto its cron
 * schedule. Safe to call multiple times — guarded by a module-level
 * latch so test imports don't accumulate handlers.
 *
 * Production calls this from `index.ts` right after `buildApp()`.
 * Tests skip this by virtue of importing only `app.ts`.
 */
export function startCronScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;

  // "0 3 * * 1" — at 03:00 every Monday (UTC by default; container
  // tz follows the host's TZ env var if set). Per Auth-Spec.md §13.2
  // we keep the cleanup off-peak.
  cron.schedule('0 3 * * 1', () => {
    runCleanupUnactivatedAccounts().catch((err) => {

      console.error('[cron] cleanup-unactivated failed', err);
    });
  });

  // "30 3 * * *" — daily at 03:30, just after the weekly user sweep on
  // Mondays. Short-lived single-use token tables accumulate dead rows
  // (spent / expired) much faster than the weekly cadence ; a daily
  // purge keeps them small and, for invites, stops the admin list from
  // showing expired-but-undeleted rows as if they were live (audit
  // 2026-06 passe 2).
  cron.schedule('30 3 * * *', () => {
    runCleanupExpiredTokens().catch((err) => {

      console.error('[cron] cleanup-expired-tokens failed', err);
    });
  });

  // eslint-disable-next-line no-console
  console.log(
    '[cron] scheduler started — cleanup-unactivated Mondays 03:00, ' +
      'cleanup-expired-tokens daily 03:30',
  );
}

/**
 * Purge accounts that were never activated within the activation
 * link's lifetime, and the verification rows tied to them.
 *
 * Logic: any user with `email_verified_at IS NULL` AND no pending
 * `email_verifications` row (= every link they were ever sent has
 * already expired or been consumed) is considered abandoned.
 *
 * Cascades:
 *   - `email_verifications` rows → ON DELETE CASCADE on user_id
 *     (kept; we don't need to delete them explicitly).
 *   - `sessions` rows → same. There shouldn't be any since the user
 *     was never activated, but cascade handles edge cases anyway.
 *
 * Exposed (un-cron) so tests / admin tooling can trigger manually.
 */
export async function runCleanupUnactivatedAccounts(): Promise<JobResult> {
  const now = new Date();

  // Two-step: first drop expired verifications so we have a clean
  // view of "no pending link"; then delete users that have no
  // verified email AND no remaining pending verifications.
  const droppedVerifs = await db
    .delete(emailVerifications)
    .where(
      and(
        eq(emailVerifications.kind, 'register'),
        lt(emailVerifications.expiresAt, now),
      ),
    )
    .returning({ id: emailVerifications.id });

  // Drop every unactivated user whose pending verifications are all
  // gone — done in a single SQL pass via `NOT EXISTS`. The previous
  // version SELECT-then-DELETE-per-row loop ran one extra query per
  // unactivated user on every job tick ; harmless on a small table,
  // wasteful on a busy install where the unactivated bucket builds
  // up between weekly runs.
  const deletedRows = await db
    .delete(users)
    .where(
      and(
        isNull(users.emailVerifiedAt),
        notExists(
          db
            .select({ id: emailVerifications.id })
            .from(emailVerifications)
            .where(
              and(
                eq(emailVerifications.userId, users.id),
                isNull(emailVerifications.consumedAt),
              ),
            ),
        ),
      ),
    )
    .returning({ id: users.id });
  const deletedUsers = deletedRows.length;

  // Sessions tied to deleted users went with them via FK CASCADE.
  // Sweep any other expired sessions while we're at it.
  const droppedSessions = await db
    .delete(sessions)
    .where(lt(sessions.expiresAt, now))
    .returning({ id: sessions.id });

  const result: JobResult = {
    name: 'cleanup-unactivated',
    counts: {
      verifications: droppedVerifs.length,
      users: deletedUsers,
      sessions: droppedSessions.length,
    },
  };

  // eslint-disable-next-line no-console
  console.log(
    `[cron] ${result.name} done`,
    JSON.stringify(result.counts),
  );
  return result;
}

/**
 * Purge spent / expired single-use security tokens (audit 2026-06
 * passe 2). These tables only ever hold short-lived rows ; leaving the
 * dead ones around bloats the table and, for invites specifically,
 * makes the admin « pending invites » list show expired rows as if
 * they were still redeemable.
 *
 * What's purged (all idempotent, set-based deletes) :
 *   - `password_reset_tokens` : expired OR already used.
 *   - `invites` : expired AND never redeemed. Redeemed invites are
 *     KEPT — they're immutable audit history (`used_by` / `used_at`),
 *     same contract the DELETE route enforces. Invites with a NULL
 *     `expires_at` never expire and are left alone.
 *   - `mfa_bypass_requests` : terminal (expired, consumed, or
 *     cancelled). An in-flight request (none of those) is preserved.
 *
 * Exposed (un-cron) so tests / admin tooling can trigger manually.
 */
export async function runCleanupExpiredTokens(): Promise<JobResult> {
  const now = new Date();

  const droppedResetTokens = await db
    .delete(passwordResetTokens)
    .where(
      or(
        lt(passwordResetTokens.expiresAt, now),
        isNotNull(passwordResetTokens.usedAt),
      ),
    )
    .returning({ id: passwordResetTokens.id });

  const droppedInvites = await db
    .delete(invites)
    .where(
      and(
        isNull(invites.usedBy),
        isNotNull(invites.expiresAt),
        lt(invites.expiresAt, now),
      ),
    )
    .returning({ id: invites.id });

  const droppedBypass = await db
    .delete(mfaBypassRequests)
    .where(
      or(
        lt(mfaBypassRequests.expiresAt, now),
        isNotNull(mfaBypassRequests.consumedAt),
        isNotNull(mfaBypassRequests.cancelledAt),
      ),
    )
    .returning({ id: mfaBypassRequests.id });

  // Stale sessions : anything past its `expires_at`, plus any `full`
  // session older than the fixed TTL (Auth-Spec §5.1 "no slide") —
  // the second clause clears rows minted under the old 30-day TTL and
  // enforces the 7-day cap at the table level, matching the cutoff
  // `resolveSession` applies on read.
  const sessionTtlCutoff = new Date(
    now.getTime() - getConfig().SESSION_TTL_SECONDS * 1000,
  );
  const droppedSessions = await db
    .delete(sessions)
    .where(
      or(
        lt(sessions.expiresAt, now),
        and(eq(sessions.kind, 'full'), lt(sessions.createdAt, sessionTtlCutoff)),
      ),
    )
    .returning({ id: sessions.id });

  const result: JobResult = {
    name: 'cleanup-expired-tokens',
    counts: {
      resetTokens: droppedResetTokens.length,
      invites: droppedInvites.length,
      bypassRequests: droppedBypass.length,
      sessions: droppedSessions.length,
    },
  };

  // eslint-disable-next-line no-console
  console.log(`[cron] ${result.name} done`, JSON.stringify(result.counts));
  return result;
}
