import type { MoodScore } from '@nodea/shared';

import { MOOD_FRISE_DAYS } from './constants';
import { toIsoDate } from './format';
import type { MoodEntryLite, MoodFriseCell, MoodFriseStats } from './types';

/**
 * Project the user's Mood lite entries onto the 14-day home
 * frise. Cells flow oldest → newest ; the rightmost cell is
 * `today`. Days without an entry stay `score`-less so they
 * render as a faint outline (gap, not zero).
 *
 * `today` is a parameter (default `new Date()`) so tests can
 * pin a fixed reference instead of fighting the wall clock.
 */
export function buildMoodFrise(
  entries: ReadonlyArray<MoodEntryLite>,
  today: Date = new Date(),
): MoodFriseCell[] {
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);

  const byDate = new Map<string, MoodScore>();
  for (const e of entries) byDate.set(e.dateIso, e.score);

  const out: MoodFriseCell[] = [];
  for (let i = MOOD_FRISE_DAYS - 1; i >= 0; i -= 1) {
    const d = new Date(refToday);
    d.setDate(refToday.getDate() - i);
    const iso = toIsoDate(d);
    const score = byDate.get(iso);
    const cell: MoodFriseCell = { dateIso: iso, isToday: i === 0 };
    if (score) cell.score = score;
    out.push(cell);
  }
  return out;
}

/** Aggregate the populated cells of a home frise. `avg` is
 *  `null` when no day in the window carried an entry, so the UI
 *  can render a placeholder instead of a numeric zero (which
 *  would falsely read as « neutre »). */
export function summariseMoodFrise(
  cells: ReadonlyArray<MoodFriseCell>,
): MoodFriseStats {
  const scored = cells.filter(
    (c): c is MoodFriseCell & { score: MoodScore } => !!c.score,
  );
  if (scored.length === 0) return { count: 0, avg: null };
  const sum = scored.reduce((s, c) => s + Number(c.score), 0);
  return { count: scored.length, avg: sum / scored.length };
}
