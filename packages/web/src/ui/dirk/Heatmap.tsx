import { Fragment, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/**
 * Generic GitHub-contributions heatmap, extracted from Mood's
 * `Chart` so Journal (issue #56) and any future module can reuse
 * the same grid + labels + legend slot. Pure layout — the caller
 * decides the cell colour by passing either a Tailwind className
 * or an inline `fill` per cell.
 *
 * Layout (CSS Grid) :
 *   - col 1 : day-of-week labels (28 px). Mon..Sun, fr convention.
 *   - col 2..weeks+1 : `weeks` columns at `1fr`, square cells.
 *   - row 1 : month labels (12 px line height). Caller positions
 *             each label at its first-week-of-month index.
 *   - rows 2..8 : 7 weekday rows.
 *   - optional last row : `legend` slot spanning every data column.
 *
 * Cell positioning is column-major within the grid : `cells[i]`
 * lands at column `floor(i / 7) + 2` (1 = labels, 2..weeks+1 = data),
 * row `i % 7 + 2`. So `cells.length` must be `weeks * 7`. Out-of-
 * range / no-data cells are `null` and render as faint outlines
 * (matches Mood's « grid stays legible without faking data »
 * convention).
 */

/**
 * One drawn cell. `className` or `fill` (mutually exclusive) sets
 * the colour ; everything else is presentational sugar.
 */
export interface HeatmapCellInput {
  /** Tooltip surfaced through the browser-native `title` attr. */
  title?: string;
  /** True for today's cell — renders an accent ring. */
  isToday?: boolean;
  /** Tailwind class for the fill (Mood passes `SCORE_FILL[score]`). */
  className?: string;
  /** Inline background-color CSS value (Journal passes
   *  `var(--heatmap-bucket-N)`). Used only when `className` is
   *  absent. */
  fill?: string;
}

export interface HeatmapMonthLabel {
  /** 0-based week column index where this month's first week sits. */
  weekIndex: number;
  /** Short label rendered above the column (« mar. », « avr. »…). */
  label: string;
}

export interface HeatmapProps {
  /** Total number of week columns (Mood + Journal both use 52). */
  weeks: number;
  /** Length must be `weeks * 7`. `null` entries render as faint
   *  outlines so the user sees the grid even where there's no
   *  data — same convention as Mood. */
  cells: ReadonlyArray<HeatmapCellInput | null>;
  /** Month labels positioned at specific column indices. */
  monthLabels: ReadonlyArray<HeatmapMonthLabel>;
  /** 7 strings, Mon..Sun, French convention. */
  dayLabels: ReadonlyArray<string>;
  /** Optional legend rendered as the final grid row, spanning the
   *  full data area. Mood drops its score-key here. */
  legend?: ReactNode;
  /** Click handler on a non-null cell. Receives the cell's index
   *  in the flat `cells` array so the caller can resolve back to
   *  its own data. */
  onCellClick?: (index: number) => void;
  /** ARIA label for the outer grid. */
  ariaLabel?: string;
  /** Grid container className override (e.g. column widths for a
   *  narrower sidebar). Defaults to a full-width fluid grid. */
  className?: string;
}

const DAYS_PER_WEEK = 7;

export default function Heatmap({
  weeks,
  cells,
  monthLabels,
  dayLabels,
  legend,
  onCellClick,
  ariaLabel,
  className,
}: HeatmapProps) {
  return (
    <div
      role="img"
      aria-label={ariaLabel}
      className={cn('grid gap-x-1 gap-y-[3px]', className)}
      style={{
        gridTemplateColumns: `28px repeat(${weeks}, minmax(0, 1fr))`,
        gridTemplateRows: `14px repeat(${DAYS_PER_WEEK}, auto)`,
      }}
    >
      {/* Top-left empty corner — keeps the grid alignment crisp. */}
      <span aria-hidden="true" style={{ gridRow: 1, gridColumn: 1 }} />

      {/* Month labels along the top. */}
      {monthLabels.map(({ weekIndex, label }) => (
        <span
          key={`m-${weekIndex}-${label}`}
          className="text-[10px] leading-none text-muted"
          style={{ gridRow: 1, gridColumn: weekIndex + 2 }}
        >
          {label}
        </span>
      ))}

      {/* Day-of-week labels down the left. */}
      {dayLabels.map((label, i) => (
        <span
          key={`d-${i}`}
          className="text-right text-[10px] leading-none text-muted"
          style={{ gridRow: i + 2, gridColumn: 1 }}
        >
          {label}
        </span>
      ))}

      {/* Heatmap cells, column-major within the data sub-grid. */}
      {cells.map((cell, i) => {
        const weekIndex = Math.floor(i / DAYS_PER_WEEK);
        const dayOfWeek = i % DAYS_PER_WEEK;
        const cellStyle = { gridRow: dayOfWeek + 2, gridColumn: weekIndex + 2 };
        if (cell === null) {
          return (
            <span
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-[2px] border border-hair/70"
              style={cellStyle}
            />
          );
        }
        const fillStyle: React.CSSProperties =
          cell.className === undefined && cell.fill !== undefined
            ? { ...cellStyle, backgroundColor: cell.fill }
            : cellStyle;
        const cellClass = cn(
          // `relative` + `hover:z-10` so the scaled cell floats
          // above its neighbours during the hover bump rather than
          // clipping behind them. The 125 % bump is large enough to
          // feel tactile on the ~10 px cells without overflowing
          // adjacent rows.
          'relative aspect-square rounded-[2px] transition-transform duration-150 hover:z-10 hover:scale-125',
          cell.className,
          cell.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
          onCellClick && 'cursor-pointer',
        );
        return (
          <Fragment key={i}>
            {onCellClick ? (
              <button
                type="button"
                title={cell.title}
                onClick={() => onCellClick(i)}
                className={cn(cellClass, 'border-0 p-0')}
                style={fillStyle}
              />
            ) : (
              <span
                title={cell.title}
                className={cellClass}
                style={fillStyle}
              />
            )}
          </Fragment>
        );
      })}

      {legend ? (
        <div
          className="pt-3"
          style={{
            gridRow: DAYS_PER_WEEK + 2,
            gridColumn: `2 / span ${weeks}`,
          }}
        >
          {legend}
        </div>
      ) : null}
    </div>
  );
}
