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
} from './modules.ts';

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
});
