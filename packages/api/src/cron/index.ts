import cron from 'node-cron';
import { and, eq, isNull, lt } from 'drizzle-orm';
import { db } from '../db/client.ts';
import { emailVerifications, sessions, users } from '../db/schema.ts';

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
      // eslint-disable-next-line no-console
      console.error('[cron] cleanup-unactivated failed', err);
    });
  });

  // eslint-disable-next-line no-console
  console.log('[cron] scheduler started — cleanup-unactivated runs Mondays at 03:00');
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

  // Find unactivated users whose only verifications (if any) are
  // already gone. Done as a single SQL pass via a subquery would be
  // tighter, but the table is small in V1 — sequential scan is fine.
  const unactivatedUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(isNull(users.emailVerifiedAt));

  let deletedUsers = 0;
  for (const user of unactivatedUsers) {
    const remaining = await db
      .select({ id: emailVerifications.id })
      .from(emailVerifications)
      .where(
        and(
          eq(emailVerifications.userId, user.id),
          isNull(emailVerifications.consumedAt),
        ),
      )
      .limit(1);
    if (remaining.length === 0) {
      await db.delete(users).where(eq(users.id, user.id));
      deletedUsers += 1;
    }
  }

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
