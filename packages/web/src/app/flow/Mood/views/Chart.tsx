import { useMemo } from 'react';
import type { MoodScore } from '@nodea/shared';

import { cn } from '@/lib/utils';

import { useMoodData, useMoodFilters } from '../context';
import { SCORE_FILL, SCORE_LABELS } from '../lib/constants';
import {
  buildHeatmap,
  HEATMAP_DAYS_PER_WEEK,
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
 * Cell sizing uses `1fr` columns + `aspect-square`, so the frise
 * stretches to fill the primary content column without needing a
 * horizontal scrollbar.
 *
 * Reads the year from the filters context and the entry list +
 * today reference from the data context. The heatmap projection
 * itself is memoised on `(year, entries, today)` so toggling
 * unrelated UI state (month filter, chart fold) doesn't pay the
 * 364-cell rebuild cost.
 */
export default function Chart() {
  const { entries, today } = useMoodData();
  const { year } = useMoodFilters();
  const { cells, monthLabels } = useMemo(
    () => buildHeatmap(year, entries, today),
    [year, entries, today],
  );
  const dayLabels = ['Lun', '', 'Mer', '', 'Ven', '', 'Dim'];

  return (
    <div
      className="grid gap-x-1 gap-y-[3px]"
      aria-hidden="true"
      style={{
        gridTemplateColumns: `28px repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))`,
        gridTemplateRows: `14px repeat(${HEATMAP_DAYS_PER_WEEK}, auto)`,
      }}
    >
      {/* Top-left empty corner — one cell to keep grid alignment crisp. */}
      <span aria-hidden="true" style={{ gridRow: 1, gridColumn: 1 }} />

      {/* Month labels along the top, positioned over the first
          week where each calendar month appears in the rolling
          year. */}
      {monthLabels.map(({ weekIndex, label }) => (
        <span
          key={`${weekIndex}-${label}`}
          className="text-[10px] leading-none text-muted"
          style={{ gridRow: 1, gridColumn: weekIndex + 2 }}
        >
          {label}
        </span>
      ))}

      {/* Day-of-week labels down the left, every other row. */}
      {dayLabels.map((label, i) => (
        <span
          key={i}
          className="text-right text-[10px] leading-none text-muted"
          style={{ gridRow: i + 2, gridColumn: 1 }}
        >
          {label}
        </span>
      ))}

      {/* Heatmap cells, column-major within the (52 × 7) sub-grid. */}
      {cells.map((cell, i) => {
        const weekIndex = Math.floor(i / HEATMAP_DAYS_PER_WEEK);
        const dayOfWeek = i % HEATMAP_DAYS_PER_WEEK;
        const style = { gridRow: dayOfWeek + 2, gridColumn: weekIndex + 2 };
        if (cell === null) {
          return (
            <span
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-[2px] border border-hair/70"
              style={style}
            />
          );
        }
        const signed = Number(cell.score) > 0 ? `+${cell.score}` : cell.score;
        return (
          <span
            key={i}
            title={`${cell.dateLabel} · ${signed}`}
            className={cn(
              'aspect-square rounded-[2px]',
              SCORE_FILL[cell.score],
              cell.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
            )}
            style={style}
          />
        );
      })}

      {/* Legend, spanning the full width below the grid. */}
      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-muted"
        style={{
          gridRow: HEATMAP_DAYS_PER_WEEK + 2,
          gridColumn: `2 / span ${HEATMAP_WEEKS}`,
        }}
      >
        {(['-2', '-1', '0', '1', '2'] as MoodScore[]).map((score) => (
          <li key={score} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('h-3 w-3 rounded-[2px]', SCORE_FILL[score])}
            />
            <span className="tabular-nums text-ink-soft">
              {Number(score) > 0 ? `+${score}` : score}
            </span>
            <span>{SCORE_LABELS[score]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
