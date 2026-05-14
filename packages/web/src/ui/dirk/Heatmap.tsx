import { useMemo, type CSSProperties } from 'react';

/**
 * Generic GitHub-style activity heatmap — issue #56.
 *
 * Renders a grid of one cell per day between `start` and `end`,
 * coloured by an intensity bucket returned by `getIntensity(date)`.
 * Columns = ISO weeks (Mon→Sun, French convention), rows = weekdays.
 *
 * Stays decoupled from any specific data shape : Journal feeds it
 * one density function, Habits can feed it another the day we
 * wire it there. The caller computes its own aggregation and only
 * exposes `(date) → 0..levels-1` here.
 *
 * Style — K · Sauge sage tones from CSS variables (no hard-coded
 * rgb so dark mode follows automatically). Bucket 0 reads as
 * « no activity » (faint hair tint), each step up walks toward
 * `--color-k-accent-deep`.
 *
 * SVG-based : zero runtime cost beyond React, no recharts /
 * calendar-heatmap KB. Cell size + gap configurable so the same
 * component can stand alone (large) or pack into a sidebar widget
 * (small).
 */
export interface HeatmapProps {
  /** First day to render. Anchored to the Monday of that week so
   *  columns line up — earlier days from that week render as
   *  blank cells outside the picked range when `padOutsideRange`
   *  is left at its default. */
  start: Date;
  /** Last day to render (inclusive). */
  end: Date;
  /** Returns `0..levels-1` for a given date. 0 = no activity.
   *  Out-of-bounds is treated as 0. */
  getIntensity: (date: Date) => number;
  /** Number of colour buckets including the « no activity » bucket.
   *  Default 5 (the GitHub feel). The component caps any
   *  `getIntensity` return above `levels - 1`. */
  levels?: number;
  /** Browser-native tooltip on hover (renders inside a `<title>` SVG
   *  node, no portal). Receives the cell date and its computed
   *  intensity bucket. */
  getTooltip?: (date: Date, intensity: number) => string;
  /** Optional cell click handler — the JournalView wires it to
   *  « filter the list on this day ». */
  onCellClick?: (date: Date) => void;
  /** Cell side in pixels. Default 11 matches Habits' frise. */
  cellSize?: number;
  /** Gap between cells in pixels. Default 2. */
  gap?: number;
  /** ARIA label for the SVG container. */
  ariaLabel?: string;
}

interface Cell {
  /** Column index (0-based, weeks). */
  x: number;
  /** Row index (0-based, Mon = 0 … Sun = 6). */
  y: number;
  /** ISO date `YYYY-MM-DD` for keys + the tooltip default. */
  iso: string;
  /** The actual Date — passed through to `getTooltip` / `onCellClick`. */
  date: Date;
  /** Raw bucket from `getIntensity`, clamped to `0..levels-1`. */
  intensity: number;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Days are anchored to the Monday of the first ISO week so the
 *  column grid is regular ; this returns Monday's `Date` for the
 *  week containing `d` (local time). */
function mondayOf(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  const offset = (out.getDay() + 6) % 7; // Sunday=0 → 6, Monday=1 → 0
  out.setDate(out.getDate() - offset);
  return out;
}

export default function Heatmap({
  start,
  end,
  getIntensity,
  levels = 5,
  getTooltip,
  onCellClick,
  cellSize = 11,
  gap = 2,
  ariaLabel,
}: HeatmapProps) {
  const { cells, weeks } = useMemo(() => {
    const collected: Cell[] = [];
    const cursor = mondayOf(start);
    const endDay = new Date(end);
    endDay.setHours(23, 59, 59, 999);
    let col = 0;
    while (cursor <= endDay) {
      const inRange = cursor >= start && cursor <= endDay;
      const row = (cursor.getDay() + 6) % 7;
      const raw = inRange ? getIntensity(cursor) : 0;
      const intensity = Math.max(0, Math.min(levels - 1, Math.floor(raw)));
      collected.push({
        x: col,
        y: row,
        iso: isoDay(cursor),
        date: new Date(cursor),
        intensity,
      });
      cursor.setDate(cursor.getDate() + 1);
      if (row === 6) col += 1;
    }
    return { cells: collected, weeks: col + 1 };
  }, [start, end, getIntensity, levels]);

  const width = weeks * (cellSize + gap);
  const height = 7 * (cellSize + gap);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={ariaLabel}
      className="max-w-full"
    >
      {cells.map((cell) => {
        const fill = `var(--heatmap-bucket-${cell.intensity})`;
        const baseStyle: CSSProperties = { fill };
        return (
          <rect
            key={cell.iso}
            x={cell.x * (cellSize + gap)}
            y={cell.y * (cellSize + gap)}
            width={cellSize}
            height={cellSize}
            rx={2}
            ry={2}
            style={baseStyle}
            className={
              onCellClick ? 'cursor-pointer transition-opacity hover:opacity-80' : ''
            }
            onClick={onCellClick ? () => onCellClick(cell.date) : undefined}
          >
            {getTooltip ? (
              <title>{getTooltip(cell.date, cell.intensity)}</title>
            ) : null}
          </rect>
        );
      })}
    </svg>
  );
}
