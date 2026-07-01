import { describe, it, expect } from 'vitest';
import { buildCycleHeatmap } from './heatmap';

describe('buildCycleHeatmap', () => {
  it('lays out weeks × 7 cells, Monday-first, ending on today’s week', () => {
    const flow = new Map([['2026-06-22', 'heavy' as const]]);
    const { cells } = buildCycleHeatmap(flow, '2026-07-01', 'fr', 4);
    expect(cells).toHaveLength(28);
    // Today is Wed 2026-07-01 → column-major, today sits in the last week.
    expect(cells.filter((c) => c?.isToday)).toHaveLength(0); // no flow logged today
    const heavy = cells.find((c) => c?.iso === '2026-06-22');
    expect(heavy?.flow).toBe('heavy');
  });

  it('marks today when it carries a flow entry', () => {
    const flow = new Map([['2026-07-01', 'light' as const]]);
    const { cells } = buildCycleHeatmap(flow, '2026-07-01', 'fr', 4);
    const todayCell = cells.find((c) => c?.isToday);
    expect(todayCell?.iso).toBe('2026-07-01');
  });

  it('emits a month label at each month boundary', () => {
    const { monthLabels } = buildCycleHeatmap(new Map(), '2026-07-01', 'fr', 26);
    expect(monthLabels.length).toBeGreaterThanOrEqual(6);
    expect(monthLabels[0]?.weekIndex).toBe(0);
  });
});
