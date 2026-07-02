import { describe, it, expect } from 'vitest';
import { averagesForYear, computeCycle } from './cycle-model';

const period = (date: string) => ({ date, flow: 'medium' as const });

describe('computeCycle', () => {
  it('estimates the next period from a regular 28-day series', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const s = computeCycle(starts.map(period), '2026-04-01');
    expect(s.status).toBe('ok');
    expect(s.averageCycle).toBe(28);
    expect(s.next?.date).toBe('2026-04-23'); // 03-26 + 28
    expect(s.next?.daysUntil).toBe(22);
    expect(s.predictedDays.has('2026-04-23')).toBe(true);
    // 4 starts → 3 completed cycles (len 28) + 1 ongoing (len null).
    expect(s.cycles).toHaveLength(4);
    expect(s.cycles.at(-1)?.length).toBeNull();
    expect(s.cycles[0]?.length).toBe(28);
    // Today (04-01) is day 7 of the cycle opened on 03-26 ; ovulation
    // ≈ day 14 (28 − 14), whose date is 03-26 + 13 = 04-08.
    expect(s.current).toEqual({
      day: 7,
      length: 28,
      ovulation: { day: 14, date: '2026-04-08' },
    });
  });

  it('segments the cycle into phases and exposes ovulation per cycle', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const s = computeCycle(starts.map(period), '2026-04-01');
    // Completed cycle opened 2026-01-01 (len 28, 1-day period, ovulation J14).
    expect(s.phaseByDate.get('2026-01-01')?.phase).toBe('menstrual');
    expect(s.phaseByDate.get('2026-01-05')?.phase).toBe('follicular');
    expect(s.phaseByDate.get('2026-01-09')?.phase).toBe('fertile');
    expect(s.phaseByDate.get('2026-01-14')?.phase).toBe('ovulation');
    expect(s.phaseByDate.get('2026-01-15')?.phase).toBe('luteal');
    // Past days are derived from logs, not projected.
    expect(s.phaseByDate.get('2026-01-14')?.predicted).toBe(false);
    // The current cycle's ovulation (2026-04-08) is a future projection.
    expect(s.phaseByDate.get('2026-04-08')).toEqual({ phase: 'ovulation', predicted: true });
    expect(s.cycles[0]?.ovulationDay).toBe(14);
  });

  it('shows the next period as a ± band, exact for steady cycles', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const s = computeCycle(starts.map(period), '2026-04-01');
    expect(s.next?.spreadDays).toBe(1); // std-dev 0 → clamped up to 1
    expect(s.next?.lo).toBe('2026-04-22');
    expect(s.next?.hi).toBe('2026-04-24');
    expect(s.approximate).toBe(false); // ≥3 cycles + exact ovulation
  });

  it('flags the estimate approximate with only two cycles of history', () => {
    const s = computeCycle(
      ['2026-01-01', '2026-01-29', '2026-02-26'].map(period),
      '2026-03-01',
    );
    expect(s.status).toBe('ok');
    expect(s.approximate).toBe(true);
  });

  it('computes 12-month median averages for cycle + period length', () => {
    const starts = ['2026-01-01', '2026-01-29', '2026-02-26', '2026-03-26'];
    const s = computeCycle(starts.map(period), '2026-04-01');
    expect(s.avg.cycle).toBe(28); // median of the three completed 28-day cycles
    expect(s.avg.cycleCount).toBe(3);
    expect(s.avg.period).toBe(1); // single-day logged periods in these fixtures
    expect(s.avg.periodCount).toBe(4);
  });

  it('excludes cycles older than 12 months from the averages', () => {
    // The 2023 cycles (incl. a huge 3-year gap) sit outside the window and must
    // not enter the median — only the two 2026 cycles count.
    const starts = ['2023-01-01', '2023-02-10', '2026-01-01', '2026-01-29', '2026-02-26'];
    const s = computeCycle(starts.map(period), '2026-03-01');
    expect(s.avg.cycle).toBe(28);
    expect(s.avg.cycleCount).toBe(2);
  });

  it('averagesForYear medians only that year’s cycles', () => {
    const starts = ['2025-01-01', '2025-01-29', '2025-02-26', '2025-03-26'];
    const s = computeCycle(starts.map(period), '2025-04-05');
    // 2025: three completed 28-day cycles (+ one ongoing).
    expect(averagesForYear(s.cycles, 2025)).toMatchObject({ cycle: 28, cycleCount: 3 });
    expect(averagesForYear(s.cycles, 2020)).toMatchObject({ cycle: null, cycleCount: 0 });
  });

  it('gives no ovulation estimate for a cycle too short to place one', () => {
    const starts = ['2026-01-01', '2026-01-13', '2026-01-25', '2026-02-06'];
    const s = computeCycle(starts.map(period), '2026-02-07');
    expect(s.averageCycle).toBe(12);
    expect(s.cycles[0]?.ovulationDay).toBeNull();
    expect(s.current?.ovulation).toBeNull();
  });

  it('refuses an estimate with fewer than two completed cycles', () => {
    const s = computeCycle([period('2026-01-01'), period('2026-01-29')], '2026-02-01');
    expect(s.status).toBe('not_enough_data');
    expect(s.next).toBeNull();
  });

  it('flags a wide spread as irregular', () => {
    const starts = ['2026-01-01', '2026-01-25', '2026-03-10', '2026-03-30'];
    const s = computeCycle(starts.map(period), '2026-04-01');
    expect(s.status).toBe('irregular');
    expect(s.next).toBeNull();
  });

  it('groups contiguous flow days into a single period, ignoring spotting', () => {
    const days = [
      period('2026-01-01'),
      period('2026-01-02'),
      { date: '2026-01-03', flow: 'spotting' as const },
    ];
    const s = computeCycle(days, '2026-01-10');
    expect(s.periodStarts).toEqual(['2026-01-01']);
    expect(s.periodDays.has('2026-01-03')).toBe(false);
  });
});
