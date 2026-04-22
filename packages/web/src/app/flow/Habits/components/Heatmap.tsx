import { useMemo } from 'react';
import type { HabitLog } from '../hooks/useHabits';

interface HeatmapProps {
  itemId: string;
  logs: HabitLog[];
  /** Number of days to display, ending today. */
  days?: number;
}

const CELL = 11;
const GAP = 2;
const INTENSITY_COLORS = [
  'rgb(226 232 240)', // 0 logs
  'rgb(134 239 172)',
  'rgb(74 222 128)',
  'rgb(34 197 94)',
  'rgb(22 163 74)',
];

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * GitHub-style activity heatmap.
 *
 * Columns = weeks, rows = weekdays (Mon→Sun). Each cell is coloured
 * from `INTENSITY_COLORS[count]` (capped at the last bucket).
 *
 * Pure SVG: zero runtime cost beyond React — recharts and the calendar
 * heatmap libs would bring KB we don't need for something this
 * geometric.
 */
export default function Heatmap({ itemId, logs, days = 365 }: HeatmapProps) {
  const { cells, weeks } = useMemo(() => {
    const end = new Date();
    end.setHours(0, 0, 0, 0);
    const start = new Date(end.getTime() - (days - 1) * 86_400_000);
    // Anchor to Monday of the starting week so columns line up weekly.
    const startDayOfWeek = (start.getDay() + 6) % 7; // 0 = Mon … 6 = Sun
    start.setDate(start.getDate() - startDayOfWeek);

    const counts = new Map<string, number>();
    for (const log of logs) {
      if (log.payload.item_rid !== itemId) continue;
      const key = String(log.payload.date).slice(0, 10);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const collected: Array<{ x: number; y: number; date: string; count: number }> = [];
    const cursor = new Date(start);
    let col = 0;
    while (cursor <= end) {
      const row = (cursor.getDay() + 6) % 7;
      const key = isoDay(cursor);
      collected.push({ x: col, y: row, date: key, count: counts.get(key) ?? 0 });
      cursor.setDate(cursor.getDate() + 1);
      if (row === 6) col += 1;
    }

    return { cells: collected, weeks: col + 1 };
  }, [itemId, logs, days]);

  const width = weeks * (CELL + GAP);
  const height = 7 * (CELL + GAP);

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label="Heatmap des logs sur les 12 derniers mois"
      className="max-w-full"
    >
      {cells.map((cell) => {
        const intensity = Math.min(cell.count, INTENSITY_COLORS.length - 1);
        return (
          <rect
            key={cell.date}
            x={cell.x * (CELL + GAP)}
            y={cell.y * (CELL + GAP)}
            width={CELL}
            height={CELL}
            rx={2}
            ry={2}
            fill={INTENSITY_COLORS[intensity]}
          >
            <title>{`${cell.date} — ${cell.count} log${cell.count > 1 ? 's' : ''}`}</title>
          </rect>
        );
      })}
    </svg>
  );
}
