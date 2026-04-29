import { describe, it, expect } from 'vitest';

import { buildHeatmap, HEATMAP_DAYS_PER_WEEK, HEATMAP_WEEKS } from './heatmap';
import type { MoodEntry } from './types';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026 (Sunday)

function entry(dateIso: string, score: MoodEntry['score']): MoodEntry {
  return {
    id: dateIso,
    dateIso,
    date: dateIso,
    score,
    positives: ['', '', ''],
  };
}

describe('buildHeatmap', () => {
  it('always returns exactly 52 × 7 cells', () => {
    const { cells } = buildHeatmap(null, [], TODAY);
    expect(cells).toHaveLength(HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK);
  });

  it('returns all-null cells when there are no entries', () => {
    const { cells } = buildHeatmap(null, [], TODAY);
    expect(cells.every((c) => c === null)).toBe(true);
  });

  it('places a today entry in the rolling window with isToday=true', () => {
    const todayIso = '2026-03-15';
    const { cells } = buildHeatmap(null, [entry(todayIso, '2')], TODAY);
    const populated = cells.filter((c) => c !== null);
    expect(populated).toHaveLength(1);
    expect(populated[0]?.score).toBe('2');
    expect(populated[0]?.isToday).toBe(true);
  });

  it('past-year entries land in the rolling window', () => {
    // 2 weeks ago on the rolling year — should be inside the
    // window and populated.
    const twoWeeksAgo = new Date(TODAY);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
    const iso = twoWeeksAgo.toISOString().slice(0, 10);
    const { cells } = buildHeatmap(null, [entry(iso, '1')], TODAY);
    const populated = cells.filter((c) => c !== null);
    expect(populated).toHaveLength(1);
    expect(populated[0]?.score).toBe('1');
    expect(populated[0]?.isToday).toBe(false);
  });

  it('drops entries outside the visible range (current year, dates after today)', () => {
    // Entry at Dec 31 of the current year — past today, should
    // not render even though the visible window goes to Dec 31.
    const { cells } = buildHeatmap(2026, [entry('2026-12-31', '2')], TODAY);
    const populated = cells.filter((c) => c !== null);
    expect(populated).toHaveLength(0);
  });

  it('drops entries that fall outside the rolling window (older than 52 weeks)', () => {
    // 53 weeks back — outside the rolling window.
    const farBack = new Date(TODAY);
    farBack.setDate(farBack.getDate() - 53 * 7);
    const iso = farBack.toISOString().slice(0, 10);
    const { cells } = buildHeatmap(null, [entry(iso, '2')], TODAY);
    const populated = cells.filter((c) => c !== null);
    expect(populated).toHaveLength(0);
  });

  it('emits at least one month label per visible month', () => {
    const { monthLabels } = buildHeatmap(null, [], TODAY);
    expect(monthLabels.length).toBeGreaterThan(0);
    // Month labels are positioned 0 ≤ weekIndex < 52.
    for (const m of monthLabels) {
      expect(m.weekIndex).toBeGreaterThanOrEqual(0);
      expect(m.weekIndex).toBeLessThan(HEATMAP_WEEKS);
    }
  });
});
