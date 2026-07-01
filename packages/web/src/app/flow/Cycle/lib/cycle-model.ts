/**
 * Cycle module — pure derivation over decrypted daily entries.
 *
 * The menstrual cycle is never stored (spec §4) : it's recomputed here
 * from the sparse daily logs. A *period* is a contiguous run of days
 * with flow ≥ light (`spotting` excluded).
 *
 * Prediction posture (grounded in ACOG / Wilcox 1995-2000 / Clue + Flo
 * methodology — calendar data predicts the next PERIOD decently but
 * OVULATION only weakly, so we're firm about periods and deliberately fuzzy
 * about fertility) :
 *   - next period  = last start + MEDIAN of the last ≤6 cycle lengths
 *                    (median, not mean — robust to a missed log that merges
 *                    two cycles), shown as a ± band, not a hard date ;
 *   - ovulation    = next period − 14 (the luteal phase is the stable part),
 *                    clamped to ≥ day 5 and to cycles ≥ 15 days, flagged
 *                    `approximate` when clamped ;
 *   - fertile      = the 6-day window [ovulation − 5, ovulation] ;
 *   - phases       = menstrual `1..P` · follicular · fertile · ovulation `O`
 *                    · luteal `O+1..L`, with O = L − 14 — the follicular
 *                    phase absorbs all the cycle-length variation.
 *   - irregular    = std-dev of recent cycle lengths ≥ 7 days → no confident
 *                    date rather than a confident-but-wrong one (spec §5).
 *
 * Where it sits : `flow/Cycle/lib`, the only place that knows cycle math —
 * the calendar / stacked view / page consume `CycleStats` and render, they
 * never recompute. ponytail: date math in UTC-noon to sidestep DST.
 */
import type { CycleFlow } from '@nodea/shared';

const DAY_MS = 86_400_000;
/** Std-dev of recent cycle lengths (days) above which we refuse to estimate
 *  (Flo's « irregular » threshold, cf. PMC8504278). */
const IRREGULAR_STDEV_DAYS = 7;
/** How many recent cycles feed the median + spread. */
const HISTORY = 6;
/** Luteal phase length : ovulation ≈ next period − 14 days (estimate). */
const LUTEAL_DAYS = 14;
/** Fertile window width before ovulation : [O − 5, O] (Wilcox et al.). */
const FERTILE_BEFORE = 5;
/** Cycles shorter than this get no ovulation/phase estimate (too short to
 *  place a plausible luteal phase — ovumcy uses the same 10 + 5 floor). */
const MIN_CYCLE_FOR_OVULATION = 15;
/** Ovulation is never placed before this cycle day. */
const MIN_OVULATION_DAY = 5;
/** ± band cap on the predicted next-period date, in days. */
const MAX_PREDICTION_SPREAD = 5;
/** Assumed length of the predicted next period, in days. */
const PREDICTED_PERIOD_DAYS = 5;

export type CycleStatus = 'ok' | 'not_enough_data' | 'irregular';

export type CyclePhase =
  | 'menstrual'
  | 'follicular'
  | 'fertile'
  | 'ovulation'
  | 'luteal';

/** A calendar day's phase, plus whether it's in the FUTURE (projected from
 *  the estimate) rather than derived from logged data. */
export interface DayPhase {
  phase: CyclePhase;
  predicted: boolean;
}

export interface CycleModelInput {
  date: string; // YYYY-MM-DD
  flow?: CycleFlow;
}

/** One detected cycle : a period start, its bleeding length, the gap to the
 *  next start (`null` for the ongoing, latest cycle), and the estimated
 *  ovulation cycle-day (`null` when the cycle is too short to place one). */
export interface CycleSpan {
  start: string;
  periodLength: number;
  length: number | null;
  ovulationDay: number | null;
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
  /** Phase of each calendar day across the logged + projected cycles — drives
   *  the calendar tinting. Ongoing-cycle days after `today` carry
   *  `predicted: true`. */
  phaseByDate: ReadonlyMap<string, DayPhase>;
  /** Where today sits in the current cycle (drives the ring). `length` is the
   *  reference cycle length, null when not yet estimable ; `ovulation` is the
   *  current cycle's estimated ovulation (cycle day + calendar date). */
  current: {
    day: number;
    length: number | null;
    ovulation: { day: number; date: string } | null;
  } | null;
  status: CycleStatus;
  /** Estimated next period ; null unless `status === 'ok'`. `spreadDays` is
   *  the ± half-width of the honest band (lo/hi are its ISO edges). */
  next: {
    date: string;
    daysUntil: number;
    spreadDays: number;
    lo: string;
    hi: string;
  } | null;
  /** True when any estimate is looser than usual (few cycles, or a clamped
   *  ovulation) — the UI prefixes « ~ » / widens wording accordingly. */
  approximate: boolean;
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
/** Sample standard deviation (n − 1). Returns 0 for < 2 values. */
function stdev(xs: readonly number[]): number {
  if (xs.length < 2) return 0;
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - mean) ** 2, 0) / (xs.length - 1);
  return Math.sqrt(v);
}
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

/** Estimated ovulation cycle-day (1-indexed) for a cycle of length `length`,
 *  or null when the cycle is too short to place one. `approximate` when the
 *  raw `length − 14` had to be clamped away from an implausible value. */
function ovulationDayFor(
  length: number | null,
): { day: number; approximate: boolean } | null {
  if (!length || length < MIN_CYCLE_FOR_OVULATION) return null;
  const raw = length - LUTEAL_DAYS;
  const day = clamp(raw, MIN_OVULATION_DAY, length - 1);
  return { day, approximate: day !== raw };
}

/** Phase of cycle-day `day` (1-indexed) given period length `P` and estimated
 *  ovulation day `O` (null ⇒ no fertility estimate for this cycle). Menstrual
 *  wins over the fertile window on short cycles / long periods. */
function phaseForDay(day: number, P: number, O: number | null): CyclePhase {
  if (day <= P) return 'menstrual';
  if (O != null) {
    if (day === O) return 'ovulation';
    if (day > O) return 'luteal';
    if (day >= O - FERTILE_BEFORE) return 'fertile';
  }
  return 'follicular';
}

/** Contiguous phase segments of a cycle as inclusive 1-indexed day ranges —
 *  for the stacked bar + the hormone-graph phase band. Menstrual wins over the
 *  fertile window on short cycles ; the ovulation day is folded into the
 *  fertile band (mark it separately). `ovulationDay` null ⇒ only menstrual +
 *  an undifferentiated follicular remainder. */
export function phaseSegments(
  length: number,
  periodLength: number,
  ovulationDay: number | null,
): ReadonlyArray<{ phase: Exclude<CyclePhase, 'ovulation'>; from: number; to: number }> {
  const P = Math.min(periodLength, length);
  const out: Array<{ phase: Exclude<CyclePhase, 'ovulation'>; from: number; to: number }> = [
    { phase: 'menstrual', from: 1, to: P },
  ];
  if (ovulationDay == null) {
    if (P + 1 <= length) out.push({ phase: 'follicular', from: P + 1, to: length });
    return out;
  }
  const fertileStart = Math.max(P + 1, ovulationDay - FERTILE_BEFORE);
  if (P + 1 <= fertileStart - 1) {
    out.push({ phase: 'follicular', from: P + 1, to: fertileStart - 1 });
  }
  if (fertileStart <= ovulationDay) {
    out.push({ phase: 'fertile', from: fertileStart, to: ovulationDay });
  }
  if (ovulationDay + 1 <= length) {
    out.push({ phase: 'luteal', from: ovulationDay + 1, to: length });
  }
  return out;
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

  // Per-cycle spans : bleeding length, gap to the next start, est. ovulation.
  const cycles: CycleSpan[] = periodStarts.map((start, i) => {
    let periodLength = 0;
    while (periodDays.has(addDays(start, periodLength))) periodLength += 1;
    const length = i < periodStarts.length - 1 ? cycleLengths[i]! : null;
    return {
      start,
      periodLength,
      length,
      ovulationDay: ovulationDayFor(length)?.day ?? null,
    };
  });

  // Paint every calendar day of every cycle with its phase. Completed cycles
  // use their own observed length ; the ongoing cycle is projected forward
  // with `averageCycle`, and days after `today` are flagged predicted.
  const phaseByDate = new Map<string, DayPhase>();
  const paint = (start: string, P: number, L: number, projected: boolean) => {
    const ov = ovulationDayFor(L)?.day ?? null;
    for (let d = 1; d <= L; d += 1) {
      const iso = addDays(start, d - 1);
      phaseByDate.set(iso, {
        phase: phaseForDay(d, P, ov),
        predicted: projected && diffDays(iso, today) > 0,
      });
    }
  };
  for (const c of cycles) {
    if (c.length != null) paint(c.start, c.periodLength, c.length, false);
  }

  // Today's position in the current (latest) cycle + its est. ovulation.
  const lastStart = periodStarts[periodStarts.length - 1];
  let current: CycleStats['current'] = null;
  let ovulationApproximate = false;
  if (lastStart && diffDays(today, lastStart) >= 0) {
    const ov = ovulationDayFor(averageCycle);
    ovulationApproximate = ov?.approximate ?? false;
    const ovulation = ov
      ? {
          day: ov.day,
          // Cycle day N ↔ lastStart + (N − 1), same convention as `current.day`.
          date: addDays(lastStart, ov.day - 1),
        }
      : null;
    current = {
      day: diffDays(today, lastStart) + 1,
      length: averageCycle,
      ovulation,
    };
    if (averageCycle) {
      let curP = 0;
      while (periodDays.has(addDays(lastStart, curP))) curP += 1;
      paint(lastStart, curP || PREDICTED_PERIOD_DAYS, averageCycle, true);
    }
  }

  const spread = recent.length
    ? clamp(Math.round(stdev(recent)), 1, MAX_PREDICTION_SPREAD)
    : MAX_PREDICTION_SPREAD;

  let status: CycleStatus = 'ok';
  let next: CycleStats['next'] = null;
  const predictedDays = new Set<string>();

  if (cycleLengths.length < 2) {
    status = 'not_enough_data';
  } else if (stdev(recent) >= IRREGULAR_STDEV_DAYS) {
    status = 'irregular';
  } else {
    const date = addDays(lastStart!, averageCycle!);
    next = {
      date,
      daysUntil: diffDays(date, today),
      spreadDays: spread,
      lo: addDays(date, -spread),
      hi: addDays(date, spread),
    };
    for (let i = 0; i < PREDICTED_PERIOD_DAYS; i += 1) {
      predictedDays.add(addDays(date, i));
    }
  }

  // « Approximate » whenever an estimate is looser than usual : a clamped
  // ovulation, or too few cycles to trust the median tightly.
  const approximate =
    status === 'ok' && (ovulationApproximate || recent.length < 3);

  return {
    periodDays,
    periodStarts,
    cycleLengths,
    cycles,
    averageCycle,
    phaseByDate,
    current,
    status,
    next,
    approximate,
    predictedDays,
  };
}
