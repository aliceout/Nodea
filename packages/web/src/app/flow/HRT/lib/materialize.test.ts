import { describe, expect, it } from 'vitest';

import { HrtSchedulePayloadSchema, type HrtSchedulePayload } from '@nodea/shared';

import { addDays, computeOccurrences, MAX_OCCURRENCES_PER_RUN } from './materialize';

/** Build a valid schedule payload, defaults filled by the schema. */
function schedule(over: Partial<HrtSchedulePayload>): HrtSchedulePayload {
  return HrtSchedulePayloadSchema.parse({
    product: 'Utrogestan',
    dose: 100,
    startDate: '2026-06-01',
    ...over,
  });
}

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-06-07', 1)).toBe('2026-06-08');
    expect(addDays('2026-06-30', 1)).toBe('2026-07-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('computeOccurrences', () => {
  it('daily, fresh : every day from start to today inclusive', () => {
    const plan = computeOccurrences(schedule({ startDate: '2026-06-05' }), '2026-06-07');
    expect(plan.dates).toEqual(['2026-06-05', '2026-06-06', '2026-06-07']);
    expect(plan.materializedThrough).toBe('2026-06-07');
  });

  it('daily, resumes from materializedThrough (no double-creation)', () => {
    const plan = computeOccurrences(
      schedule({ startDate: '2026-06-01', materializedThrough: '2026-06-05' }),
      '2026-06-07',
    );
    expect(plan.dates).toEqual(['2026-06-06', '2026-06-07']);
    expect(plan.materializedThrough).toBe('2026-06-07');
  });

  it('up to date : nothing to generate', () => {
    const plan = computeOccurrences(
      schedule({ materializedThrough: '2026-06-07' }),
      '2026-06-07',
    );
    expect(plan.dates).toEqual([]);
    expect(plan.materializedThrough).toBe('2026-06-07');
  });

  it('every_n_days : steps by N from the start', () => {
    const plan = computeOccurrences(
      schedule({ startDate: '2026-06-01', frequency: 'every_n_days', everyNDays: 5 }),
      '2026-06-16',
    );
    expect(plan.dates).toEqual(['2026-06-01', '2026-06-06', '2026-06-11', '2026-06-16']);
  });

  it('every_n_days : resume stays on the N-day grid', () => {
    const plan = computeOccurrences(
      schedule({
        startDate: '2026-06-01',
        frequency: 'every_n_days',
        everyNDays: 5,
        materializedThrough: '2026-06-06',
      }),
      '2026-06-20',
    );
    expect(plan.dates).toEqual(['2026-06-11', '2026-06-16']);
  });

  it('future start : nothing until it begins', () => {
    const plan = computeOccurrences(schedule({ startDate: '2026-07-01' }), '2026-06-07');
    expect(plan.dates).toEqual([]);
  });

  it('ended : stops at endDate, not today', () => {
    const plan = computeOccurrences(
      schedule({ startDate: '2026-06-01', endDate: '2026-06-03' }),
      '2026-06-10',
    );
    expect(plan.dates).toEqual(['2026-06-01', '2026-06-02', '2026-06-03']);
  });

  it('caps a far-past start at MAX_OCCURRENCES_PER_RUN', () => {
    const plan = computeOccurrences(schedule({ startDate: '2000-01-01' }), '2026-06-07');
    expect(plan.dates).toHaveLength(MAX_OCCURRENCES_PER_RUN);
    expect(plan.dates[0]).toBe('2000-01-01');
    // Resumes on the next run from the capped point.
    expect(plan.materializedThrough).toBe(plan.dates[MAX_OCCURRENCES_PER_RUN - 1]);
  });
});
