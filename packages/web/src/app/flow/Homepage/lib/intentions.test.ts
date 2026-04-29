import { describe, expect, it } from 'vitest';

import { pickHomeGoals } from './intentions';
import type { GoalEntryLite, GoalStatusLite } from './types';

function goal(
  id: string,
  status: GoalStatusLite,
  updatedAt: string,
): GoalEntryLite {
  return { id, status, updatedAt, title: id, thread: '' };
}

describe('pickHomeGoals', () => {
  it('puts wip first then open, both sorted by updatedAt desc', () => {
    const out = pickHomeGoals([
      goal('o1', 'open', '2026-03-10T00:00:00Z'),
      goal('w1', 'wip', '2026-03-12T00:00:00Z'),
      goal('o2', 'open', '2026-03-14T00:00:00Z'),
      goal('w2', 'wip', '2026-03-15T00:00:00Z'),
    ]);
    expect(out.map((g) => g.id)).toEqual(['w2', 'w1', 'o2', 'o1']);
  });

  it('drops done goals entirely', () => {
    const out = pickHomeGoals([
      goal('w1', 'wip', '2026-03-15T00:00:00Z'),
      goal('d1', 'done', '2026-03-20T00:00:00Z'),
    ]);
    expect(out.map((g) => g.id)).toEqual(['w1']);
  });

  it('caps at the limit (default 5, override accepted)', () => {
    const many = Array.from({ length: 8 }, (_, i) =>
      goal(`g${i}`, 'open', `2026-03-${String(20 - i).padStart(2, '0')}T00:00:00Z`),
    );
    expect(pickHomeGoals(many)).toHaveLength(5);
    expect(pickHomeGoals(many, 2)).toHaveLength(2);
    expect(pickHomeGoals(many, 0)).toHaveLength(0);
  });

  it('does not mutate the input array', () => {
    const input: GoalEntryLite[] = [
      goal('o1', 'open', '2026-03-10T00:00:00Z'),
      goal('w1', 'wip', '2026-03-15T00:00:00Z'),
    ];
    const before = [...input];
    pickHomeGoals(input);
    expect(input).toEqual(before);
  });
});
