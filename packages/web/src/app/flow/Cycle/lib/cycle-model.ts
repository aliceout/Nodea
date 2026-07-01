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
/** Assumed length of the predicted next period, in days. */
const PREDICTED_PERIOD_DAYS = 5;

export type CycleStatus = 'ok' | 'not_enough_data' | 'irregular';

export interface CycleModelInput {
  date: string; // YYYY-MM-DD
  flow?: CycleFlow;
}

export interface CycleStats {
  /** Every logged day that is part of a period (flow ≥ light). */
  periodDays: ReadonlySet<string>;
  /** First day of each detected period, ascending. */
  periodStarts: readonly string[];
  /** Consecutive period-start gaps, in days. */
  cycleLengths: readonly number[];
  /** Median of the last ≤6 cycle lengths, or null when none. */
  averageCycle: number | null;
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
    averageCycle,
    status,
    next,
    predictedDays,
  };
}
