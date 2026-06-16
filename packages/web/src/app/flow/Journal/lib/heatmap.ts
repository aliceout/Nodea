import type {
  HeatmapCellInput,
  HeatmapMonthLabel,
} from '@/ui/dirk/Heatmap';
import { formatLongDate } from '@/core/i18n/date-format';

import { densityToIntensity, type DayDensity } from './day-density';
import { isoDay } from './stats';

/** Default heatmap width — matches Mood and the rest of the
 *  GitHub-style frises in the app. */
export const HEATMAP_WEEKS = 52;

/** Mobile fallback width. Below `md:`, the 52-column grid renders
 *  cells at ≈ 5 px each and the month labels collide. 17 weeks ≈
 *  4 months — same compromise as `Mood/lib/heatmap.ts`. */
export const COMPACT_HEATMAP_WEEKS = 17;

const DAYS_PER_WEEK = 7;

type Translator = (
  key: string,
  opts?: { values?: Record<string, unknown> },
) => string;

/**
 * Project the writing-density map onto a `weeks` × 7 heatmap grid,
 * column-major. Extracted from `views/Chart.tsx` so the same builder
 * can produce both the 52-week desktop view and the 26-week compact
 * mobile view side-by-side without duplicating the date arithmetic.
 *
 * Range :
 *   - `year === null` (« En cours ») : rolling `weeks` weeks
 *     ending today, trailing days of the current week render as
 *     null outlines.
 *   - `year === YYYY` : the `weeks` weeks anchored on the Monday
 *     of the year's first week. Everything outside the calendar
 *     year is null. The current `Chart` always passes 52 in this
 *     branch ; the compact view is only used for the rolling
 *     window where 26 weeks of context is enough on a phone.
 *
 * Cells flow column-major in the output : `cells[0..6]` = oldest
 * column (Mon..Sun), `cells[(weeks-1)*7..weeks*7-1]` = most recent
 * week. The same indexing applies to the parallel `cellIsoDays`
 * array so the click handler can resolve a cell index back to its
 * ISO date.
 */
export function buildJournalHeatmap(
  weeks: number,
  year: number | null,
  byDay: ReadonlyMap<string, DayDensity>,
  today: Date,
  language: string,
  t: Translator,
): {
  cells: Array<HeatmapCellInput | null>;
  monthLabels: HeatmapMonthLabel[];
  cellIsoDays: Array<string | null>;
} {
  const refToday = new Date(today);
  refToday.setHours(0, 0, 0, 0);
  const todayTime = refToday.getTime();

  let oldestMonday: Date;
  let rangeStartTime: number;
  let rangeEndTime: number;
  if (year === null) {
    const endDow = (refToday.getDay() + 6) % 7;
    const thisMonday = new Date(refToday);
    thisMonday.setDate(refToday.getDate() - endDow);
    oldestMonday = new Date(thisMonday);
    oldestMonday.setDate(thisMonday.getDate() - (weeks - 1) * 7);
    rangeStartTime = oldestMonday.getTime();
    rangeEndTime = todayTime;
  } else {
    const jan1 = new Date(year, 0, 1);
    const jan1Dow = (jan1.getDay() + 6) % 7;
    // Step BACK to that week's Monday so the year's first
    // week lands fully inside column 0 even if Jan 1 is, say,
    // a Wednesday.
    oldestMonday = new Date(jan1);
    oldestMonday.setDate(jan1.getDate() - jan1Dow);
    const dec31 = new Date(year, 11, 31, 23, 59, 59);
    rangeStartTime = jan1.getTime();
    rangeEndTime = dec31.getTime();
  }

  const cellsOut: Array<HeatmapCellInput | null> = [];
  const isos: Array<string | null> = [];
  for (let i = 0; i < weeks * DAYS_PER_WEEK; i++) {
    const cellDate = new Date(oldestMonday);
    cellDate.setDate(oldestMonday.getDate() + i);
    const cellTime = cellDate.getTime();
    const iso = isoDay(cellDate);

    // Out-of-range : before the picked year's Jan 1, after its
    // Dec 31, or after today in « En cours ».
    if (cellTime < rangeStartTime || cellTime > rangeEndTime) {
      cellsOut.push(null);
      isos.push(null);
      continue;
    }

    const density: DayDensity | undefined = byDay.get(iso);
    if (!density) {
      cellsOut.push(null);
      // Empty in-range days still get an ISO so the user can
      // click an outline to focus the list on a no-entry day.
      isos.push(iso);
      continue;
    }
    const bucket = densityToIntensity(density);
    const label = formatLongDate(iso, language);
    cellsOut.push({
      fill: `var(--heatmap-bucket-${bucket})`,
      isToday: cellTime === todayTime,
      title: t('journal.heatmap.tooltip', {
        values: { date: label, count: density.count, words: density.words },
      }),
    });
    isos.push(iso);
  }

  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  const labels: HeatmapMonthLabel[] = [];
  let prevMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const monday = new Date(oldestMonday);
    monday.setDate(oldestMonday.getDate() + w * 7);
    if (monday.getMonth() !== prevMonth) {
      labels.push({ weekIndex: w, label: monthFormatter.format(monday) });
      prevMonth = monday.getMonth();
    }
  }

  return { cells: cellsOut, monthLabels: labels, cellIsoDays: isos };
}
