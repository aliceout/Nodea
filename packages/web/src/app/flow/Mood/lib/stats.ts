import { DAY_NAMES_FR, SHORT_MONTHS_FR } from './constants';
import type { MoodEntry, Pattern } from './types';

/** 30-day rolling average mood score. `null` when no entries
 *  fell within the window, so the UI can render a placeholder
 *  instead of a numeric zero (which would falsely read as
 *  « perfectly neutral »). `today` is a parameter (default
 *  `new Date()`) for testability. */
export function computeAverage30d(
  entries: ReadonlyArray<MoodEntry>,
  today: Date = new Date(),
): number | null {
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const cutoff = refToday.getTime() - 30 * 24 * 3600 * 1000;
  const recent = entries.filter((e) => new Date(e.dateIso).getTime() >= cutoff);
  if (recent.length === 0) return null;
  const sum = recent.reduce((acc, e) => acc + Number(e.score), 0);
  return Math.round((sum / recent.length) * 10) / 10;
}

/** Format a 30-day rolling average for display. `null` becomes
 *  `'—'` (data placeholder) ; signed values use the FR-friendly
 *  unicode minus and a comma decimal. */
export function formatMoodAvg(avg: number | null): string {
  if (avg === null) return '—';
  const sign = avg > 0 ? '+' : avg < 0 ? '−' : '';
  const abs = Math.abs(avg).toFixed(1).replace('.', ',');
  return `${sign}${abs}`;
}

/** Signed `+X,Y` / `−X,Y` formatter used by `computePatterns`
 *  for delta strings (« +0,4 vs moyenne »). */
export function signedFormat(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value).toFixed(1).replace('.', ',');
  return `${sign}${abs}`;
}

/**
 * Patterns are computed over `{date, score}` only — no external
 * signals (sleep, calendar, weather…) because the app doesn't
 * capture them ; surfacing fake correlations undermines trust.
 *
 * Three signals, each surfaced only when the data supports it :
 *  - best / worst day of the week (mean score per weekday vs the
 *    overall mean, requires ≥ 3 entries on the day to dampen
 *    one-shot noise).
 *  - longest non-negative streak — counts consecutive entries
 *    (not calendar days), so a missed day doesn't break the
 *    streak.
 *  - 30-day rolling mean vs 90-day rolling mean, only shown when
 *    the gap is meaningful (≥ 0.2 on the −2..+2 scale).
 *
 * `today` is a parameter (default `new Date()`) so tests pin a
 * fixed reference rather than fight the wall clock.
 */
export function computePatterns(
  entries: ReadonlyArray<MoodEntry>,
  today: Date = new Date(),
): Pattern[] {
  const out: Pattern[] = [];
  if (entries.length < 5) return out;

  // 1) Best / worst day of the week
  const buckets: number[][] = [[], [], [], [], [], [], []]; // Mon..Sun
  for (const e of entries) {
    const d = new Date(e.dateIso);
    if (Number.isNaN(d.getTime())) continue;
    const dow = (d.getDay() + 6) % 7; // shift Sun=0..Sat=6 → Mon=0..Sun=6
    buckets[dow]!.push(Number(e.score));
  }
  const allScores = entries.map((e) => Number(e.score));
  const overallMean = allScores.reduce((s, v) => s + v, 0) / allScores.length;
  const MIN_PER_DAY = 3;
  let bestIdx = -1;
  let worstIdx = -1;
  let bestMean = -Infinity;
  let worstMean = Infinity;
  for (let i = 0; i < 7; i += 1) {
    const bucket = buckets[i]!;
    if (bucket.length < MIN_PER_DAY) continue;
    const mean = bucket.reduce((s, v) => s + v, 0) / bucket.length;
    if (mean > bestMean) {
      bestMean = mean;
      bestIdx = i;
    }
    if (mean < worstMean) {
      worstMean = mean;
      worstIdx = i;
    }
  }
  if (bestIdx >= 0) {
    out.push({
      label: `${DAY_NAMES_FR[bestIdx]} est ton meilleur jour`,
      delta: `${signedFormat(bestMean - overallMean)} vs moyenne`,
    });
  }
  if (worstIdx >= 0 && worstIdx !== bestIdx) {
    out.push({
      label: `${DAY_NAMES_FR[worstIdx]} reste ton point bas`,
      delta: `${signedFormat(worstMean - overallMean)} vs moyenne`,
    });
  }

  // 2) Longest non-negative streak (consecutive entries, gaps OK)
  const sortedAsc = [...entries].sort((a, b) =>
    a.dateIso.localeCompare(b.dateIso),
  );
  let current = 0;
  let currentStart: string | null = null;
  let bestCount = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  for (const e of sortedAsc) {
    if (Number(e.score) >= 0) {
      if (current === 0) currentStart = e.dateIso;
      current += 1;
      if (current > bestCount) {
        bestCount = current;
        bestStart = currentStart;
        bestEnd = e.dateIso;
      }
    } else {
      current = 0;
      currentStart = null;
    }
  }
  if (bestCount >= 3 && bestStart && bestEnd) {
    out.push({
      label: `${bestCount} entrées ≥ 0 d’affilée`,
      delta: formatStreakRange(bestStart, bestEnd),
    });
  }

  // 3) 30-day mean vs 90-day mean (trend)
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const dayMs = 24 * 3600 * 1000;
  const cutoff30 = refToday.getTime() - 30 * dayMs;
  const cutoff90 = refToday.getTime() - 90 * dayMs;
  const last30: number[] = [];
  const last90: number[] = [];
  for (const e of entries) {
    const t = new Date(e.dateIso).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= cutoff30) last30.push(Number(e.score));
    if (t >= cutoff90) last90.push(Number(e.score));
  }
  if (last30.length >= 5 && last90.length >= 10) {
    const m30 = last30.reduce((s, v) => s + v, 0) / last30.length;
    const m90 = last90.reduce((s, v) => s + v, 0) / last90.length;
    const delta = m30 - m90;
    if (Math.abs(delta) >= 0.2) {
      out.push({
        label: delta > 0 ? 'Tendance à la hausse' : 'Tendance à la baisse',
        delta: `${signedFormat(delta)} vs 90 j`,
      });
    }
  }

  return out;
}

/** Format a streak's start..end ISO range for display. Same year :
 *  drops the year from the start so « du 12 mars au 18 mars 2026 »
 *  reads as « du 12 mars au 18 mars 2026 ». Cross-year keeps both. */
function formatStreakRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  if (startIso === endIso) {
    return `le ${formatShortDate(start)}`;
  }
  if (start.getFullYear() === end.getFullYear()) {
    return `du ${start.getDate()} ${SHORT_MONTHS_FR[start.getMonth()]} au ${formatShortDate(end)}`;
  }
  return `du ${formatShortDate(start)} au ${formatShortDate(end)}`;
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}
