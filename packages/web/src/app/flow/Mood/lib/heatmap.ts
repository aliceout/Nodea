import type { MoodScore } from '@nodea/shared';

import { toIsoDate } from '@/core/i18n/date-format';

import { rangeFor } from './date-format';
import type { HeatmapCell, MonthLabel, MoodEntry } from './types';

/** Narrowed input type for `buildHeatmap` — it only needs the
 *  date + score, not the full `MoodEntry` (no id, no positives).
 *  Lets the homepage feed its `MoodEntryLite` projection without
 *  a cast. */
export type HeatmapEntry = Pick<MoodEntry, 'dateIso' | 'score'>;

/** GitHub-style frise dimensions. 52 weeks × 7 days = 364 cells. */
export const HEATMAP_WEEKS = 52;
export const HEATMAP_DAYS_PER_WEEK = 7;

/**
 * Project a flat list of `MoodEntry`s onto the 52 × 7 heatmap
 * grid.
 *
 * Cells flow column-major : `cells[0..6]` = oldest column
 * (Mon..Sun), `cells[357..363]` = the most recent week.
 *
 * Single uniform rule per cell :
 * - if the cell's date falls outside `[start, dataEnd]`
 *   (computed by `rangeFor(year, today)`), the cell is `null`
 *   (rendered as faint outline) — keeps the trailing weeks of
 *   the current year visible but empty ;
 * - else, look the cell's `dateIso` up in the entries map : a
 *   hit becomes a coloured cell with the matching score ; a
 *   miss stays `null` so days without an entry read as gaps,
 *   not zeros.
 *
 * `today` is a parameter (default `new Date()`) so tests can pin
 * the reference date instead of fighting the wall clock.
 */
export function buildHeatmap(
  year: number | null,
  entries: ReadonlyArray<HeatmapEntry>,
  today: Date = new Date(),
  weeks: number = HEATMAP_WEEKS,
): {
  cells: Array<HeatmapCell | null>;
  monthLabels: MonthLabel[];
} {
  const total = weeks * HEATMAP_DAYS_PER_WEEK;
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const currentYear = refToday.getFullYear();
  const todayTime = refToday.getTime();
  const { start, end, dataEnd } = rangeFor(year, refToday, weeks);
  const startTime = start.getTime();
  const dataEndTime = dataEnd.getTime();

  // Index entries by ISO date for O(1) lookup per cell.
  const entriesByDate = new Map<string, MoodScore>();
  for (const entry of entries) entriesByDate.set(entry.dateIso, entry.score);

  // Anchor at the oldest visible Monday — `end`'s week's Monday
  // minus 51 weeks. From there, cell index `i` maps to a
  // calendar date by `i` days (column-major flow walks the same
  // way : Mon..Sun of week 0, then Mon..Sun of week 1, …).
  const endDow = (end.getDay() + 6) % 7;
  const lastWeekMonday = new Date(end);
  lastWeekMonday.setDate(end.getDate() - endDow);
  const oldestMonday = new Date(lastWeekMonday);
  oldestMonday.setDate(lastWeekMonday.getDate() - (weeks - 1) * 7);

  const sameYearFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const crossYearFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cells: Array<HeatmapCell | null> = [];
  for (let i = 0; i < total; i++) {
    const cellDate = new Date(oldestMonday);
    cellDate.setDate(oldestMonday.getDate() + i);
    const t = cellDate.getTime();
    if (t < startTime || t > dataEndTime) {
      cells.push(null);
      continue;
    }
    const score = entriesByDate.get(toIsoDate(cellDate));
    if (!score) {
      // Day in range but no entry — show as faint gap, not zero.
      cells.push(null);
      continue;
    }
    const fmt = cellDate.getFullYear() === currentYear ? sameYearFmt : crossYearFmt;
    cells.push({
      score,
      isToday: t === todayTime,
      dateLabel: fmt.format(cellDate),
    });
  }

  // Month labels : every time a week's Monday lands in a
  // different calendar month than the previous week's Monday,
  // drop a label.
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const weeksAgo = weeks - 1 - w;
    const monday = new Date(lastWeekMonday);
    monday.setDate(lastWeekMonday.getDate() - weeksAgo * 7);
    if (monday.getMonth() !== prevMonth) {
      monthLabels.push({ weekIndex: w, label: monthFormatter.format(monday) });
      prevMonth = monday.getMonth();
    }
  }
  return { cells, monthLabels };
}
