/**
 * Canary tests for the module-payload `.default()` semantics.
 *
 * Zod 4 made one observable change to `.default()`: on the chain
 * `.default('x').optional()`, parsing `{}` now returns `{ field: 'x' }`
 * where Zod 3 returned `{}`. The opposite order — `.optional().default()`
 * — is unchanged. The Nodea module schemas use the safe order
 * (optional first) in the one chained site (`moodEmoji`), and elsewhere
 * use plain `.default(...)` whose semantics are stable across the
 * upgrade.
 *
 * These tests pin the round-tripped defaults so any future schema /
 * Zod change that flips a key from « always present » to « sometimes
 * absent » (or vice-versa) surfaces here rather than in an encrypted-
 * blob decode that silently misses a field downstream.
 */
import { describe, expect, it } from 'vitest';

import {
  GoalsPayloadSchema,
  MoodPayloadSchema,
  HrtAdminLogPayloadSchema,
  HrtLabResultPayloadSchema,
  HrtProductPayloadSchema,
  HrtSchedulePayloadSchema,
} from './modules/index.ts';

describe('Module payload defaults', () => {
  it('MoodPayload.parse fills every defaulted field from a minimal input', () => {
    const parsed = MoodPayloadSchema.parse({
      date: '2026-06-04',
      moodScore: '1',
    });
    expect(parsed.moodEmoji).toBe('');
    expect(parsed.positive1).toBe('');
    expect(parsed.positive2).toBe('');
    expect(parsed.positive3).toBe('');
    expect(parsed.comment).toBe('');
  });

  it('GoalsPayload.parse fills every defaulted field including nullable defaults', () => {
    const parsed = GoalsPayloadSchema.parse({
      title: 'Read more',
    });
    expect(parsed.date).toBe('');
    expect(parsed.note).toBe('');
    expect(parsed.status).toBe('open');
    expect(parsed.thread).toBe('');
    expect(parsed.completedAt).toBeNull();
    expect(parsed.updatedAt).toBe('');
  });

  it('explicit values flow through without being clobbered by defaults', () => {
    const parsed = GoalsPayloadSchema.parse({
      title: 'Read more',
      status: 'done',
      completedAt: '2026-06-04T10:00:00.000Z',
    });
    expect(parsed.status).toBe('done');
    expect(parsed.completedAt).toBe('2026-06-04T10:00:00.000Z');
  });

  it('HrtAdminLogPayload references a product, fills defaults, rejects bad dose', () => {
    const parsed = HrtAdminLogPayloadSchema.parse({
      date: '2026-06-04',
      product: 'Estradiol valérate (préparation)',
      dose: 0.4,
    });
    expect(parsed.time).toBe('');
    expect(parsed.notes).toBe('');
    expect(parsed.updatedAt).toBe('');
    expect(parsed.scheduleId).toBeUndefined();
    // product is required (catalog-only) and dose must be ≥ 0.
    expect(() => HrtAdminLogPayloadSchema.parse({ date: '2026-06-04', dose: 1 })).toThrow();
    expect(() =>
      HrtAdminLogPayloadSchema.parse({ date: '2026-06-04', product: 'X', dose: -1 }),
    ).toThrow();
  });

  it('HrtAdminLogPayload keeps an optional scheduleId for generated occurrences', () => {
    const auto = HrtAdminLogPayloadSchema.parse({
      date: '2026-06-07',
      product: 'Utrogestan',
      dose: 100,
      scheduleId: 'sched-1',
    });
    expect(auto.scheduleId).toBe('sched-1');
  });

  it('HrtSchedulePayload requires product + startDate, defaults frequency / endDate', () => {
    const parsed = HrtSchedulePayloadSchema.parse({
      product: 'Utrogestan',
      dose: 100,
      startDate: '2026-06-01',
    });
    expect(parsed.frequency).toBe('daily');
    expect(parsed.endDate).toBeNull();
    expect(parsed.materializedThrough).toBe('');
    expect(parsed.everyNDays).toBeUndefined();
    const every = HrtSchedulePayloadSchema.parse({
      product: 'Astrovial',
      dose: 4,
      startDate: '2026-06-01',
      frequency: 'every_n_days',
      everyNDays: 5,
    });
    expect(every.everyNDays).toBe(5);
    // product + startDate required ; interval must be a positive integer.
    expect(() => HrtSchedulePayloadSchema.parse({ dose: 1, startDate: '2026-06-01' })).toThrow();
    expect(() => HrtSchedulePayloadSchema.parse({ product: 'X', dose: 1 })).toThrow();
    expect(() =>
      HrtSchedulePayloadSchema.parse({ product: 'X', dose: 1, startDate: '2026-06-01', everyNDays: 0 }),
    ).toThrow();
  });

  it('HrtProductPayload requires a name, defaults its fields, keeps concentration optional', () => {
    const parsed = HrtProductPayloadSchema.parse({ name: 'Aldactone' });
    expect(parsed.medication).toBe('');
    expect(parsed.category).toBe('other');
    expect(parsed.route).toBe('other');
    expect(parsed.unit).toBe('mg');
    expect(parsed.concentration).toBeUndefined();
    expect(parsed.archived).toBe(false);
    const inj = HrtProductPayloadSchema.parse({
      name: 'Estradiol valérate',
      medication: 'Estradiol valérate',
      category: 'estrogen',
      route: 'injection_im',
      unit: 'mL',
      concentration: 10,
    });
    expect(inj.concentration).toBe(10);
    expect(() => HrtProductPayloadSchema.parse({ name: '' })).toThrow();
    expect(() => HrtProductPayloadSchema.parse({ name: 'X', concentration: 0 })).toThrow();
  });

  it('HrtLabResultPayload.parse defaults context to unknown and keeps marker/unit free', () => {
    const parsed = HrtLabResultPayloadSchema.parse({
      date: '2026-06-04',
      marker: 'estradiol',
      value: 165,
      unit: 'pg/mL',
    });
    expect(parsed.context).toBe('unknown');
    expect(parsed.lab).toBe('');
    expect(parsed.notes).toBe('');
    expect(parsed.updatedAt).toBe('');
  });

  it('HrtLabResultPayload requires a unit and accepts a negative-adjacent value', () => {
    expect(() =>
      HrtLabResultPayloadSchema.parse({ date: '2026-06-04', marker: 'x', value: 1, unit: '' }),
    ).toThrow();
    const parsed = HrtLabResultPayloadSchema.parse({
      date: '2026-06-04',
      marker: 'custom_marker',
      value: 0,
      unit: 'arb',
      context: 'trough',
    });
    expect(parsed.value).toBe(0);
    expect(parsed.context).toBe('trough');
  });
});
