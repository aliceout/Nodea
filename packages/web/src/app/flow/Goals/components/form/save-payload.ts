/**
 * Pure helpers for the Goal composer's save flow.
 *
 * Extracted from `Goal.tsx` (decomposition follow-up) — these are
 * stateless, deterministic, and trivially unit-testable. The
 * parent's `handleSave` orchestrates I/O ; this file just shapes
 * the payload it sends.
 *
 * `composeDate` mirrors the legacy `composeDate(year, month)` :
 * both → `YYYY-MM`, year alone → bare `YYYY` (the Goals page's
 * `formatDate` tolerates the bare-year shape via its regex
 * fallback ; a goal dated to a year with no specific month is a
 * real intention, not garbage). Month without year drops to
 * empty — a month with no year can't be ordered or formatted
 * unambiguously.
 *
 * `buildGoalPayload` carries the `completedAt` boundary logic —
 * same rules as the Goals page's status toggle. Flipping into
 * `done` seeds `now`, flipping out clears, staying-in-done
 * preserves the previous value.
 */
import type { GoalsPayload } from '@nodea/shared';

import { isCanonicalGoalStatus } from '@/ui/dirk/forms/guards';
import type { GoalStatus } from '@/ui/dirk/forms/constants';

export function composeDate(year: string, month: string): string {
  if (year && month) return `${year}-${month}`;
  if (year) return year;
  return '';
}

export interface BuildGoalPayloadArgs {
  title: string;
  year: string;
  month: string;
  status: GoalStatus;
  thread: string;
  note: string;
  /** When set, signals an update flow ; the previous payload's
   *  `completedAt` + `status` drive the boundary logic. When
   *  null, this is a brand-new entry — `completedAt` is `now` if
   *  the user picked `done`, else `null`. */
  editing: GoalsPayload | null;
}

export function buildGoalPayload(args: BuildGoalPayloadArgs): GoalsPayload {
  const { title, year, month, status, thread, note, editing } = args;
  const previousCompletedAt =
    typeof editing?.completedAt === 'string' ? editing.completedAt : null;
  const previousStatus = isCanonicalGoalStatus(editing?.status)
    ? editing!.status
    : 'open';
  const nextCompletedAt =
    status === 'done'
      ? previousStatus === 'done'
        ? previousCompletedAt
        : new Date().toISOString()
      : null;
  return {
    date: composeDate(year, month),
    title: title.trim(),
    note,
    status,
    thread: thread.trim(),
    completedAt: nextCompletedAt,
    updatedAt: new Date().toISOString(),
  };
}
