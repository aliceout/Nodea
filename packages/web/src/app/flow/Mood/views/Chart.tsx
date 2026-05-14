import { useMemo } from 'react';
import type { MoodScore } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Heatmap, {
  type HeatmapCellInput,
} from '@/ui/dirk/Heatmap';
import { cn } from '@/lib/utils';

import { useMoodData, useMoodFilters } from '../context';
import { SCORE_FILL } from '../lib/constants';
import {
  buildHeatmap,
  HEATMAP_WEEKS,
} from '../lib/heatmap';

/**
 * GitHub-style mood frise. 52 columns of weeks (rolling year —
 * when the current year isn't complete, the trailing weeks come
 * from last year, exactly like GitHub's contribution graph), 7
 * rows of days (Mon..Sun, French convention). Each cell is
 * colour-coded by score ; days without an entry render as a faint
 * outline so the grid stays legible without faking data. Today
 * carries an accent ring ; cells after today (rest of this week)
 * drop out.
 *
 * Issue #56 — extracted the grid + labels into the shared
 * `ui/dirk/Heatmap` component so Journal can mount the same
 * visual surface with its own (density-based) palette. This file
 * stays in charge of mapping Mood-scored cells to fill classes
 * and surfacing the score legend below the grid.
 */
export default function Chart() {
  const { t } = useI18n();
  const { entries, today } = useMoodData();
  const { year } = useMoodFilters();
  const { cells, monthLabels } = useMemo(
    () => buildHeatmap(year, entries, today),
    [year, entries, today],
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

  // Map the Mood heatmap output to the shared component's input.
  // Empty cells stay `null` ; scored cells carry their fill class
  // and a `dateLabel · ±N` tooltip.
  const heatmapCells: Array<HeatmapCellInput | null> = useMemo(
    () =>
      cells.map((cell) => {
        if (cell === null) return null;
        const signed = Number(cell.score) > 0 ? `+${cell.score}` : cell.score;
        return {
          className: SCORE_FILL[cell.score],
          isToday: cell.isToday,
          title: `${cell.dateLabel} · ${signed}`,
        };
      }),
    [cells],
  );

  const legend = (
    <ul className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
      {(['-2', '-1', '0', '1', '2'] as MoodScore[]).map((score) => (
        <li key={score} className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn('h-3 w-3 rounded-[2px]', SCORE_FILL[score])}
          />
          <span className="tabular-nums text-ink-soft">
            {Number(score) > 0 ? `+${score}` : score}
          </span>
          <span>{t(`mood.scoreLabels.${score}`)}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <Heatmap
      weeks={HEATMAP_WEEKS}
      cells={heatmapCells}
      monthLabels={monthLabels}
      dayLabels={dayLabels}
      legend={legend}
    />
  );
}
