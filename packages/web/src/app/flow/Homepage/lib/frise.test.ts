import { describe, expect, it } from 'vitest';

import { MOOD_FRISE_DAYS } from './constants';
import { buildMoodFrise, summariseMoodFrise } from './frise';
import type { MoodEntryLite } from './types';

const TODAY = new Date(2026, 2, 15); // 15 mars 2026

function entry(dateIso: string, score: '-2' | '-1' | '0' | '1' | '2'): MoodEntryLite {
  return { dateIso, score, createdAt: dateIso };
}

describe('buildMoodFrise', () => {
  it('returns exactly MOOD_FRISE_DAYS cells, oldest → newest', () => {
    const cells = buildMoodFrise([], TODAY);
    expect(cells).toHaveLength(MOOD_FRISE_DAYS);
    expect(cells[0]?.dateIso).toBe('2026-03-02');
    expect(cells[MOOD_FRISE_DAYS - 1]?.dateIso).toBe('2026-03-15');
  });

  it('flags only the rightmost cell as today', () => {
    const cells = buildMoodFrise([], TODAY);
    expect(cells[MOOD_FRISE_DAYS - 1]?.isToday).toBe(true);
    expect(cells.slice(0, -1).every((c) => !c.isToday)).toBe(true);
  });

  it('attaches scores by ISO date and leaves missing days score-less', () => {
    const cells = buildMoodFrise(
      [entry('2026-03-15', '2'), entry('2026-03-10', '-1')],
      TODAY,
    );
    const today = cells.find((c) => c.dateIso === '2026-03-15');
    const tenth = cells.find((c) => c.dateIso === '2026-03-10');
    const ninth = cells.find((c) => c.dateIso === '2026-03-09');
    expect(today?.score).toBe('2');
    expect(tenth?.score).toBe('-1');
    expect(ninth?.score).toBeUndefined();
  });

  it('ignores entries outside the 14-day window', () => {
    const cells = buildMoodFrise(
      [entry('2026-02-10', '2'), entry('2025-03-15', '1')],
      TODAY,
    );
    expect(cells.every((c) => c.score === undefined)).toBe(true);
  });

  it('normalises today to local midnight (mid-day reference works)', () => {
    const midDay = new Date(2026, 2, 15, 14, 30);
    const cells = buildMoodFrise([], midDay);
    expect(cells[MOOD_FRISE_DAYS - 1]?.dateIso).toBe('2026-03-15');
  });
});

describe('summariseMoodFrise', () => {
  it('returns null avg when no cell carries a score', () => {
    const cells = buildMoodFrise([], TODAY);
    expect(summariseMoodFrise(cells)).toEqual({ count: 0, avg: null });
  });

  it('averages only populated cells', () => {
    const cells = buildMoodFrise(
      [
        entry('2026-03-15', '2'),
        entry('2026-03-14', '0'),
        entry('2026-03-13', '-2'),
      ],
      TODAY,
    );
    const summary = summariseMoodFrise(cells);
    expect(summary.count).toBe(3);
    expect(summary.avg).toBe(0); // (2 + 0 - 2) / 3
  });
});
