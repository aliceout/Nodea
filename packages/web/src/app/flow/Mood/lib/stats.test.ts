import { describe, it, expect } from 'vitest';

import {
  computeAverage30d,
  computePatterns,
  formatMoodAvg,
  signedFormat,
  type StatsTranslate,
} from './stats';
import type { MoodEntry } from './types';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026 (Sunday)

// Tiny FR catalog mirroring `locales/fr/mood.json` `stats.*` — the
// lib takes a translate fn now, so the assertions below keep
// matching the real FR copy without a React tree.
const FR_STATS: Record<string, string> = {
  'mood.stats.bestDay': '{day} est ton meilleur jour',
  'mood.stats.worstDay': '{day} reste ton point bas',
  'mood.stats.vsAverage': '{delta} vs moyenne',
  'mood.stats.streak': '{count} entrées ≥ 0 d’affilée',
  'mood.stats.trendUp': 'Tendance à la hausse',
  'mood.stats.trendDown': 'Tendance à la baisse',
  'mood.stats.vs90d': '{delta} vs 90 j',
  'mood.stats.streakSingleDay': 'le {date}',
  'mood.stats.streakRange': 'du {start} au {end}',
};

const t: StatsTranslate = (key, values) => {
  let out = FR_STATS[key] ?? key;
  for (const [token, value] of Object.entries(values ?? {})) {
    out = out.replaceAll(`{${token}}`, String(value));
  }
  return out;
};

function entry(dateIso: string, score: MoodEntry['score']): MoodEntry {
  return {
    id: dateIso,
    dateIso,
    date: dateIso,
    score,
    positives: ['', '', ''],
    searchHaystack: '',
  };
}

describe('signedFormat', () => {
  it('uses + for positives, − for negatives, none for zero', () => {
    expect(signedFormat(0.5)).toBe('+0,5');
    expect(signedFormat(-0.5)).toBe('−0,5');
    expect(signedFormat(0)).toBe('0,0');
  });

  it('formats with comma decimal and one digit of precision', () => {
    expect(signedFormat(1.234)).toBe('+1,2');
    expect(signedFormat(-0.07)).toBe('−0,1');
  });
});

describe('formatMoodAvg', () => {
  it('returns « — » for null', () => {
    expect(formatMoodAvg(null)).toBe('—');
  });

  it('returns the signed average otherwise', () => {
    expect(formatMoodAvg(0.5)).toBe('+0,5');
    expect(formatMoodAvg(-1.2)).toBe('−1,2');
    expect(formatMoodAvg(0)).toBe('0,0');
  });
});

describe('computeAverage30d', () => {
  it('returns null when no entries fall within 30 days', () => {
    expect(computeAverage30d([], TODAY)).toBeNull();
    expect(
      computeAverage30d([entry('2025-01-01', '2')], TODAY),
    ).toBeNull();
  });

  it('averages recent scores rounded to one decimal', () => {
    const recent = [
      entry('2026-03-14', '2'),
      entry('2026-03-13', '1'),
      entry('2026-03-12', '0'),
    ];
    expect(computeAverage30d(recent, TODAY)).toBe(1);
  });

  it('ignores entries older than 30 days', () => {
    const mixed = [
      entry('2026-03-14', '2'), // recent → counts
      entry('2025-01-01', '-2'), // old → ignored
    ];
    expect(computeAverage30d(mixed, TODAY)).toBe(2);
  });
});

describe('computePatterns', () => {
  it('returns [] when fewer than 5 entries', () => {
    expect(computePatterns([], t, TODAY)).toEqual([]);
    expect(
      computePatterns([entry('2026-03-14', '2')], t, TODAY),
    ).toEqual([]);
  });

  it('surfaces best day of the week when ≥ 3 entries on that day', () => {
    // 3 Sundays at +2, plus 5 other entries at 0.
    const entries: MoodEntry[] = [
      entry('2026-03-15', '2'), // Sunday
      entry('2026-03-08', '2'), // Sunday
      entry('2026-03-01', '2'), // Sunday
      entry('2026-03-14', '0'),
      entry('2026-03-13', '0'),
      entry('2026-03-12', '0'),
      entry('2026-03-11', '0'),
      entry('2026-03-10', '0'),
    ];
    const patterns = computePatterns(entries, t, TODAY);
    const best = patterns.find((p) => p.label.includes('meilleur jour'));
    expect(best).toBeDefined();
    expect(best?.label).toMatch(/Dimanche/i);
  });

  it('surfaces a 3+ non-negative streak with the date range', () => {
    const entries: MoodEntry[] = [
      entry('2026-03-10', '1'),
      entry('2026-03-11', '0'),
      entry('2026-03-12', '2'),
      entry('2026-03-13', '1'),
      entry('2026-03-14', '0'),
    ];
    const patterns = computePatterns(entries, t, TODAY);
    const streak = patterns.find((p) => p.label.includes('d’affilée'));
    expect(streak).toBeDefined();
    expect(streak?.label).toMatch(/^5 entrées ≥ 0/);
  });

  it('surfaces a clear 30 vs 90 day trend (≥ 0.2 delta)', () => {
    // 30-day window : 5 entries at +2 → mean = 2.
    // 90-day window : same 5 + 5 entries at -2 → mean = 0.
    // Delta = 2 - 0 = 2 → trend up surfaces.
    const recent: MoodEntry[] = [
      entry('2026-03-14', '2'),
      entry('2026-03-13', '2'),
      entry('2026-03-12', '2'),
      entry('2026-03-11', '2'),
      entry('2026-03-10', '2'),
    ];
    const older: MoodEntry[] = [
      entry('2026-01-15', '-2'),
      entry('2026-01-16', '-2'),
      entry('2026-01-17', '-2'),
      entry('2026-01-18', '-2'),
      entry('2026-01-19', '-2'),
    ];
    const patterns = computePatterns([...recent, ...older], t, TODAY);
    const trend = patterns.find((p) => p.label.includes('Tendance'));
    expect(trend).toBeDefined();
    expect(trend?.label).toBe('Tendance à la hausse');
  });

  it('does not surface a trend when the delta is below 0.2', () => {
    const flat: MoodEntry[] = Array.from({ length: 12 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, '0');
      return entry(`2026-02-${day}`, '0');
    });
    const patterns = computePatterns(flat, t, TODAY);
    expect(patterns.find((p) => p.label.includes('Tendance'))).toBeUndefined();
  });
});
