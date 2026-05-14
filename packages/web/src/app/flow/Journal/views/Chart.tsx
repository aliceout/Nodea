import { useMemo } from 'react';

import { formatLongDate } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, {
  type HeatmapCellInput,
  type HeatmapMonthLabel,
} from '@/ui/dirk/Heatmap';

import { useJournalData, useJournalFilters } from '../context';
import {
  aggregateByDay,
  densityToIntensity,
  type DayDensity,
} from '../lib/day-density';
import { isoDay } from '../lib/stats';

const WEEKS = 52;
const DAYS_PER_WEEK = 7;

/**
 * Writing-density heatmap for the Journal (issue #56). Mirrors
 * Mood's `Chart` layout : 52 weeks × 7 days, month labels at the
 * top, day-of-week labels on the left. Cells coloured by the
 * day's writing intensity (word-count buckets through
 * `--heatmap-bucket-N`).
 *
 * Range driven by `year` from the filters context :
 *   - `null` (« En cours ») : rolling 52 weeks ending today.
 *     The trailing days of the current week render as faint
 *     outlines.
 *   - a number (e.g. 2025) : the 52 weeks anchored on that
 *     calendar year's Monday-of-the-first-week through the
 *     Monday-of-the-last-week, with everything outside the year
 *     rendered as outlines.
 *
 * Click a cell → toggle `dayFilter` on the filters context to
 * focus the list below on that day.
 */
export default function Chart() {
  const { t, language } = useI18n();
  const { entries } = useJournalData();
  const { year, dayFilter, setDayFilter } = useJournalFilters();

  const byDay = useMemo(() => aggregateByDay(entries), [entries]);

  const { cells, monthLabels, dayLabels, cellIsoDays } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    // Range :
    //   - null → rolling 52 weeks ending this week's Monday.
    //   - YYYY → 52 weeks anchored on the first Monday of YYYY
    //     (the last column lands on the Monday of its last week
    //     so the grid stays the regular 52 columns wide).
    let oldestMonday: Date;
    let rangeStartTime: number;
    let rangeEndTime: number;
    if (year === null) {
      const endDow = (today.getDay() + 6) % 7;
      const thisMonday = new Date(today);
      thisMonday.setDate(today.getDate() - endDow);
      oldestMonday = new Date(thisMonday);
      oldestMonday.setDate(thisMonday.getDate() - (WEEKS - 1) * 7);
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
    for (let i = 0; i < WEEKS * DAYS_PER_WEEK; i++) {
      const cellDate = new Date(oldestMonday);
      cellDate.setDate(oldestMonday.getDate() + i);
      const cellTime = cellDate.getTime();
      const iso = isoDay(cellDate);

      // Out-of-range : before the picked year's Jan 1, after
      // its Dec 31, or after today in « En cours ».
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
    for (let w = 0; w < WEEKS; w++) {
      const monday = new Date(oldestMonday);
      monday.setDate(oldestMonday.getDate() + w * 7);
      if (monday.getMonth() !== prevMonth) {
        labels.push({ weekIndex: w, label: monthFormatter.format(monday) });
        prevMonth = monday.getMonth();
      }
    }

    const dayLabelsOut = [
      t('mood.chart.day0'),
      t('mood.chart.day1'),
      t('mood.chart.day2'),
      t('mood.chart.day3'),
      t('mood.chart.day4'),
      t('mood.chart.day5'),
      t('mood.chart.day6'),
    ];

    return {
      cells: cellsOut,
      monthLabels: labels,
      dayLabels: dayLabelsOut,
      cellIsoDays: isos,
    };
  }, [byDay, year, language, t]);

  function onCellClick(index: number) {
    const iso = cellIsoDays[index];
    if (!iso) return;
    setDayFilter(dayFilter === iso ? null : iso);
  }

  return (
    <Heatmap
      weeks={WEEKS}
      cells={cells}
      monthLabels={monthLabels}
      dayLabels={dayLabels}
      onCellClick={onCellClick}
      ariaLabel={t('journal.heatmap.ariaLabel')}
      // Journal pioche le style « constellation de points » plutôt
      // que les tuiles GitHub — même grammaire visuelle que les
      // pastilles de statut dans `IntentionsBlock` (Homepage aside).
      // Plus papier, moins contribution-graph.
      shape="circle"
    />
  );
}
