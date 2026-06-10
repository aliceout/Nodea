import { describe, it, expect } from 'vitest';

import { byDateDesc } from './sort';
import type { GoalEntry } from './types';

function fixture(date: string): GoalEntry {
  return {
    id: 'x',
    date,
    title: 'X',
    note: '',
    status: 'open',
    thread: '',
    updatedAt: '2025-01-01T00:00:00.000Z',
    completedAt: null,
    searchHaystack: '',
  };
}

describe('byDateDesc', () => {
  it('sorts YYYY-MM dates newest-first', () => {
    const a = fixture('2024-03');
    const b = fixture('2025-01');
    expect(byDateDesc(a, b)).toBeGreaterThan(0); // a after b
    expect(byDateDesc(b, a)).toBeLessThan(0); // b before a
  });

  it('sorts YYYY-MM-DD dates newest-first', () => {
    const a = fixture('2025-03-15');
    const b = fixture('2025-03-20');
    expect(byDateDesc(a, b)).toBeGreaterThan(0);
  });

  it('returns 0 when dates are equal', () => {
    expect(byDateDesc(fixture('2025-03'), fixture('2025-03'))).toBe(0);
  });

  it('sinks empty dates to the end', () => {
    const dated = fixture('2025-01');
    const undated = fixture('');
    expect(byDateDesc(undated, dated)).toBeGreaterThan(0); // undated last
    expect(byDateDesc(dated, undated)).toBeLessThan(0); // dated first
  });

  it('treats two empty dates as equal', () => {
    expect(byDateDesc(fixture(''), fixture(''))).toBe(0);
  });
});
