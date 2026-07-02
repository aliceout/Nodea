import type { CycleFlow, CyclePayload } from '@nodea/shared';

/**
 * Mock Cycle entries for `seed:test cycle`. Six period starts over ~6
 * months at a ~28-day cadence with mild variation (27-29 d), so the
 * next-period estimate reads « ok » while the stacked view still shows
 * length variability. Each period is 4 flow days + a trailing spotting
 * day, with a couple of symptoms. The most recent start is 10 days ago,
 * so the ring lands mid-cycle. Dates are relative to run time.
 */

function days(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/** Period starts, in « days ago » (gaps: 28, 27, 28, 29, 28). */
const CYCLE_STARTS = [150, 122, 95, 67, 38, 10];
const FLOWS: readonly CycleFlow[] = ['heavy', 'heavy', 'medium', 'light', 'spotting'];

function cycle(startAgo: number): CyclePayload[] {
  return FLOWS.map((flow, i) => ({
    date: days(startAgo - i),
    flow,
    symptoms: i === 0 ? ['crampes', 'fatigue'] : i === 3 ? ['maux de tête'] : [],
    notes: '',
  }));
}

export function buildCycleFixtures(): CyclePayload[] {
  return CYCLE_STARTS.flatMap(cycle);
}
