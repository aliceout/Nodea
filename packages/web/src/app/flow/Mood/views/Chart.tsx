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
  COMPACT_HEATMAP_WEEKS,
  HEATMAP_WEEKS,
} from '../lib/heatmap';
import type { HeatmapCell } from '../lib/types';

// Pure mapper from a Mood heatmap output row to the shared
// `<Heatmap>` cell input shape. Lives at module scope so the two
// useMemos in `Chart` don't have to chase a render-scoped
// reference through their dependency arrays.
function toHeatmapCells(
  raw: ReadonlyArray<HeatmapCell | null>,
): Array<HeatmapCellInput | null> {
  return raw.map((cell) => {
    if (cell === null) return null;
    const signed = Number(cell.score) > 0 ? `+${cell.score}` : cell.score;
    return {
      className: SCORE_FILL[cell.score],
      isToday: cell.isToday,
      title: `${cell.dateLabel} · ${signed}`,
    };
  });
}

/**
 * GitHub-style mood frise. 52 columns of weeks on desktop (`md+`,
 * rolling year — when the current year isn't complete, the
 * trailing weeks come from last year, exactly like GitHub's
 * contribution graph) ; 26 columns below `md`. Same component on
 * both sides — only the `weeks` prop changes — so the colour
 * scheme, today-ring, and tooltip behaviour stay identical. The
 * 26-column compact view matches the Homepage's `MoodBlock`,
 * which is already vetted on phones. 7 rows of days
 * (Mon..Sun, French convention) in both modes. Days without an
 * entry render as a faint outline so the grid stays legible
 * without faking data.
 *
 * Two `<Heatmap>` instances are rendered with `hidden md:block`
 * / `md:hidden` rather than a runtime media-query hook. The
 * data builds are cheap (≤ 364 cells of arithmetic) and the
 * CSS-toggle pattern keeps Tailwind as the single source of
 * truth for the breakpoint.
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
  const fullYear = useMemo(
    () => buildHeatmap(year, entries, today),
    [year, entries, today],
  );
  const compact = useMemo(
    () => buildHeatmap(year, entries, today, COMPACT_HEATMAP_WEEKS),
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

  // Mapping is a pure module-level function — keeps the useMemo
  // deps to the upstream cell arrays only.
  const fullYearCells = useMemo(
    () => toHeatmapCells(fullYear.cells),
    [fullYear.cells],
  );
  const compactCells = useMemo(
    () => toHeatmapCells(compact.cells),
    [compact.cells],
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
    <>
      <div className="hidden md:block">
        <Heatmap
          weeks={HEATMAP_WEEKS}
          cells={fullYearCells}
          monthLabels={fullYear.monthLabels}
          dayLabels={dayLabels}
          legend={legend}
        />
      </div>
      <div className="md:hidden">
        <Heatmap
          weeks={COMPACT_HEATMAP_WEEKS}
          cells={compactCells}
          monthLabels={compact.monthLabels}
          dayLabels={dayLabels}
          legend={legend}
        />
      </div>
    </>
  );
}
