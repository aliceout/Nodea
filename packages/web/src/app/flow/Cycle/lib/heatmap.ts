/**
 * Cycle heatmap builder — projects logged flow days onto a
 * GitHub-contributions grid (`weeks × 7`, column-major, Monday-first),
 * ending on the week that holds today. Pure : feeds the shared
 * `ui/dirk/Heatmap` the same way Mood's `buildHeatmap` does. Full
 * rolling year (52 weeks), like the Mood / Journal frise, with a 17-week
 * compact fallback for mobile. Date math in UTC-noon to sidestep DST.
 */
import type { CycleFlow } from '@nodea/shared';

/** Full year, same as Mood/Journal (52 × 7 = 364 cells). */
export const CYCLE_HEATMAP_WEEKS = 52;
/** Mobile fallback (≈ 4 months) — matches Mood's compact width. */
export const CYCLE_HEATMAP_COMPACT_WEEKS = 17;
const DAY_MS = 86_400_000;

export interface CycleHeatCell {
  iso: string;
  flow: CycleFlow;
  isToday: boolean;
}
export interface CycleMonthLabel {
  weekIndex: number;
  label: string;
}

function toMs(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number);
  return Date.UTC(y!, m! - 1, d!, 12);
}
function toIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function buildCycleHeatmap(
  flowByDate: ReadonlyMap<string, CycleFlow>,
  todayIso: string,
  language: string,
  weeks: number = CYCLE_HEATMAP_WEEKS,
): { cells: Array<CycleHeatCell | null>; monthLabels: CycleMonthLabel[] } {
  const todayMs = toMs(todayIso);
  const todayDow = (new Date(todayMs).getUTCDay() + 6) % 7; // Monday = 0
  const lastMondayMs = todayMs - todayDow * DAY_MS;
  const oldestMondayMs = lastMondayMs - (weeks - 1) * 7 * DAY_MS;

  const cells: Array<CycleHeatCell | null> = [];
  for (let i = 0; i < weeks * 7; i += 1) {
    const ms = oldestMondayMs + i * DAY_MS;
    if (ms > todayMs) {
      cells.push(null); // future days in the current week
      continue;
    }
    const iso = toIso(ms);
    const flow = flowByDate.get(iso);
    cells.push(flow ? { iso, flow, isToday: ms === todayMs } : null);
  }

  const monthFmt = new Intl.DateTimeFormat(language, { month: 'short' });
  const monthLabels: CycleMonthLabel[] = [];
  let prev = -1;
  for (let w = 0; w < weeks; w += 1) {
    const ms = lastMondayMs - (weeks - 1 - w) * 7 * DAY_MS;
    const month = new Date(ms).getUTCMonth();
    if (month !== prev) {
      monthLabels.push({ weekIndex: w, label: monthFmt.format(new Date(ms)) });
      prev = month;
    }
  }
  return { cells, monthLabels };
}
