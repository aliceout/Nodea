import { describe, it, expect } from 'vitest';
import { computeCycle } from './cycle-model';

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
