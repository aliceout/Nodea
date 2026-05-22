import { useMemo } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap from '@/ui/dirk/Heatmap';

import { useJournalData, useJournalFilters } from '../context';
import { aggregateByDay } from '../lib/day-density';
import {
  buildJournalHeatmap,
  COMPACT_HEATMAP_WEEKS,
  HEATMAP_WEEKS,
} from '../lib/heatmap';

/**
 * Writing-density heatmap for the Journal (issue #56). 52 weeks
 * × 7 days on `md+`, 26 weeks × 7 days below `md` so the cells
 * stay readable on phone widths — same compact-on-mobile pattern
 * as `Mood/views/Chart.tsx`. Both heatmaps render and CSS
 * (`hidden md:block` / `md:hidden`) picks which one is visible ;
 * the date arithmetic is cheap enough that two passes is
 * cheaper than a runtime media-query hook.
 *
 * Range driven by `year` from the filters context :
 *   - `null` (« En cours ») : rolling 52 / 26 weeks ending today.
 *     Trailing days of the current week render as faint outlines.
 *   - a number (e.g. 2025) : anchored on Jan 1 of that year.
 *     The compact view also uses this branch (showing the first
 *     26 weeks of the year) ; if anyone needs « last 26 weeks of
 *     a past year » we'll branch then.
 *
 * Click a cell → toggle `dayFilter` on the filters context to
 * focus the list below on that day.
 */
export default function Chart() {
  const { t, language } = useI18n();
  const { entries } = useJournalData();
  const { year, dayFilter, setDayFilter } = useJournalFilters();

  const byDay = useMemo(() => aggregateByDay(entries), [entries]);

  const fullYear = useMemo(
    () => buildJournalHeatmap(HEATMAP_WEEKS, year, byDay, new Date(), language, t),
    [year, byDay, language, t],
  );
  const compact = useMemo(
    () => buildJournalHeatmap(COMPACT_HEATMAP_WEEKS, year, byDay, new Date(), language, t),
    [year, byDay, language, t],
  );

  const dayLabels = [
    t('mood.chart.day0'),
    t('mood.chart.day1'),
    t('mood.chart.day2'),
    t('mood.chart.day3'),
    t('mood.chart.day4'),
    t('mood.chart.day5'),
    t('mood.chart.day6'),
  ];

  function makeOnCellClick(isoDays: Array<string | null>) {
    return (index: number) => {
      const iso = isoDays[index];
      if (!iso) return;
      setDayFilter(dayFilter === iso ? null : iso);
    };
  }

  return (
    <>
      <div className="hidden md:block">
        <Heatmap
          weeks={HEATMAP_WEEKS}
          cells={fullYear.cells}
          monthLabels={fullYear.monthLabels}
          dayLabels={dayLabels}
          onCellClick={makeOnCellClick(fullYear.cellIsoDays)}
          ariaLabel={t('journal.heatmap.ariaLabel')}
        />
      </div>
      <div className="md:hidden">
        <Heatmap
          weeks={COMPACT_HEATMAP_WEEKS}
          cells={compact.cells}
          monthLabels={compact.monthLabels}
          dayLabels={dayLabels}
          onCellClick={makeOnCellClick(compact.cellIsoDays)}
          ariaLabel={t('journal.heatmap.ariaLabel')}
        />
      </div>
    </>
  );
}
