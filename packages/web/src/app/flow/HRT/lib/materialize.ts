/**
 * HRT · schedule materialisation — the pure core that decides which dose
 * occurrences a recurring `HrtSchedule` should generate.
 *
 * Kept side-effect-free (no clock, no I/O) so it's exhaustively unit
 * tested : the caller passes « today » and persists the result. The
 * generator resumes from `materializedThrough` (exclusive) so a date is
 * never created twice, steps by 1 day (`daily`) or `everyNDays`, and
 * stops at `min(today, endDate)`. A per-run cap bounds the write burst of
 * a far-past start ; the next open continues where it left off.
 */
import type { HrtSchedulePayload } from '@nodea/shared';

/** Cap on occurrences materialised in a single pass — protects against a
 *  pathological back-fill (a years-old start). The next run resumes. */
export const MAX_OCCURRENCES_PER_RUN = 730;

/** Add `days` to an ISO `YYYY-MM-DD` date (local), returning ISO. */
export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + days);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

export interface OccurrencePlan {
  /** Dates (ISO `YYYY-MM-DD`) to materialise, ascending. */
  dates: string[];
  /** The new `materializedThrough` (last generated date), or the
   *  schedule's current value when nothing is generated. */
  materializedThrough: string;
}

/**
 * The occurrences `schedule` should materialise given « today » (ISO).
 * Returns no dates when it's up to date, hasn't started, or has ended.
 */
export function computeOccurrences(
  schedule: HrtSchedulePayload,
  todayIso: string,
): OccurrencePlan {
  const step =
    schedule.frequency === 'every_n_days' ? Math.max(schedule.everyNDays ?? 1, 1) : 1;
  // Upper bound : today, or the (earlier) planned end date.
  const upTo = schedule.endDate && schedule.endDate < todayIso ? schedule.endDate : todayIso;

  // First date not yet materialised : one step past the resume point, or
  // the start date on the very first run.
  let next = schedule.materializedThrough
    ? addDays(schedule.materializedThrough, step)
    : schedule.startDate;

  const dates: string[] = [];
  while (next <= upTo && dates.length < MAX_OCCURRENCES_PER_RUN) {
    if (next >= schedule.startDate) dates.push(next);
    next = addDays(next, step);
  }

  return {
    dates,
    materializedThrough: dates.length > 0 ? dates[dates.length - 1]! : schedule.materializedThrough,
  };
}
