/**
 * Cycle module — pure derivation over decrypted daily entries.
 *
 * The menstrual cycle is never stored (spec §4) : it's recomputed here
 * from the sparse daily logs. A *period* is a contiguous run of days
 * with flow ≥ light (`spotting` excluded). The next-period estimate is
 * the last period start + median of the last ≤6 cycle lengths, under
 * the irregular-cycle rule (spec §5) : too few cycles, or too wide a
 * spread, yields no date rather than a confident-but-wrong one.
 *
 * Where it sits : `flow/Cycle/lib`, the only place that knows cycle
 * math — the calendar + page consume `CycleStats` and render, they
 * never recompute. ponytail: date math in UTC-noon to sidestep DST ;
 * « irregular » is a fixed 9-day range heuristic — swap for stddev if
 * it misjudges real cycles.
 */
import type { CycleFlow } from '@nodea/shared';

const DAY_MS = 86_400_000;
/** Consecutive-cycle spread above which we refuse to estimate. */
const IRREGULAR_RANGE_DAYS = 9;
/** How many recent cycles feed the median. */
const HISTORY = 6;
/** Luteal phase length : ovulation ≈ next period − 14 days (estimate). */
const LUTEAL_DAYS = 14;
/** Assumed length of the predicted next period, in days. */
const PREDICTED_PERIOD_DAYS = 5;

export type CycleStatus = 'ok' | 'not_enough_data' | 'irregular';

export interface CycleModelInput {
  date: string; // YYYY-MM-DD
  flow?: CycleFlow;
}

/** One detected cycle : a period start, its bleeding length, and the
 *  gap to the next start (`null` for the ongoing, latest cycle). */
export interface CycleSpan {
  start: string;
  periodLength: number;
  length: number | null;
}

export interface CycleStats {
  /** Every logged day that is part of a period (flow ≥ light). */
  periodDays: ReadonlySet<string>;
  /** First day of each detected period, ascending. */
  periodStarts: readonly string[];
  /** Consecutive period-start gaps, in days. */
  cycleLengths: readonly number[];
  /** One entry per period start, oldest → newest (drives the stacked view). */
  cycles: readonly CycleSpan[];
  /** Median of the last ≤6 cycle lengths, or null when none. */
  averageCycle: number | null;
  /** Where today sits in the current cycle (drives the ring). `length`
   *  is the reference cycle length, null when not yet estimable ;
   *  `ovulation` is the current cycle's estimated ovulation (cycle day
   *  + calendar date), null when there's no reliable length. */
  current: {
    day: number;
    length: number | null;
    ovulation: { day: number; date: string } | null;
  } | null;
  status: CycleStatus;
  /** Estimated next period ; null unless `status === 'ok'`. */
  next: { date: string; daysUntil: number } | null;
  /** The predicted next-period band (empty unless `status === 'ok'`). */
  predictedDays: ReadonlySet<string>;
}

function toMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!, 12);
}
function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
function addDays(iso: string, n: number): string {
  return toIso(toMs(iso) + n * DAY_MS);
}
function diffDays(a: string, b: string): number {
  return Math.round((toMs(a) - toMs(b)) / DAY_MS);
}
function median(xs: readonly number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
}

export function computeCycle(
  entries: readonly CycleModelInput[],
  today: string,
): CycleStats {
  const periodDays = new Set(
    entries.filter((e) => e.flow && e.flow !== 'spotting').map((e) => e.date),
  );
  const sorted = [...periodDays].sort();
  // A period *start* is a period day whose previous calendar day isn't one.
  const periodStarts = sorted.filter((d) => !periodDays.has(addDays(d, -1)));

  const cycleLengths: number[] = [];
  for (let i = 1; i < periodStarts.length; i += 1) {
    cycleLengths.push(diffDays(periodStarts[i]!, periodStarts[i - 1]!));
  }

  const recent = cycleLengths.slice(-HISTORY);
  const averageCycle = recent.length ? median(recent) : null;

  // Per-cycle spans : bleeding length + gap to the next start.
  const cycles: CycleSpan[] = periodStarts.map((start, i) => {
    let periodLength = 0;
    while (periodDays.has(addDays(start, periodLength))) periodLength += 1;
    return {
      start,
      periodLength,
      length: i < periodStarts.length - 1 ? cycleLengths[i]! : null,
    };
  });

  // Today's position in the current (latest) cycle + its est. ovulation.
  const lastStart = periodStarts[periodStarts.length - 1];
  let current: CycleStats['current'] = null;
  if (lastStart && diffDays(today, lastStart) >= 0) {
    const ovulation =
      averageCycle && averageCycle > LUTEAL_DAYS
        ? {
            day: averageCycle - LUTEAL_DAYS,
            // Cycle day N ↔ lastStart + (N − 1) — same convention as
            // `current.day`, so the « ~J14 · <date> » caption agrees.
            date: addDays(lastStart, averageCycle - LUTEAL_DAYS - 1),
          }
        : null;
    current = { day: diffDays(today, lastStart) + 1, length: averageCycle, ovulation };
  }

  let status: CycleStatus = 'ok';
  let next: CycleStats['next'] = null;
  const predictedDays = new Set<string>();

  if (cycleLengths.length < 2) {
    status = 'not_enough_data';
  } else if (Math.max(...recent) - Math.min(...recent) > IRREGULAR_RANGE_DAYS) {
    status = 'irregular';
  } else {
    const date = addDays(periodStarts[periodStarts.length - 1]!, averageCycle!);
    next = { date, daysUntil: diffDays(date, today) };
    for (let i = 0; i < PREDICTED_PERIOD_DAYS; i += 1) {
      predictedDays.add(addDays(date, i));
    }
  }

  return {
    periodDays,
    periodStarts,
    cycleLengths,
    cycles,
    averageCycle,
    current,
    status,
    next,
    predictedDays,
  };
}
