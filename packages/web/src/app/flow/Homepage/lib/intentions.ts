import { HOME_GOAL_LIMIT } from './constants';
import type { GoalEntryLite } from './types';

/**
 * Pick what the home « Goals » block surfaces : `wip` first
 * (most recently updated), then `open` (most recently updated),
 * capped at `HOME_GOAL_LIMIT` items. `done` goals are filtered
 * out — the block is for « what's on my plate », not « what
 * I've achieved » (the Goals page archives section covers the
 * latter).
 *
 * `limit` is a parameter for testability ; production calls
 * leave the default.
 */
export function pickHomeGoals(
  entries: ReadonlyArray<GoalEntryLite>,
  limit: number = HOME_GOAL_LIMIT,
): GoalEntryLite[] {
  const wip = entries.filter((e) => e.status === 'wip');
  const open = entries.filter((e) => e.status === 'open');
  const byUpdatedDesc = (a: GoalEntryLite, b: GoalEntryLite) =>
    b.updatedAt.localeCompare(a.updatedAt);
  const sortedWip = [...wip].sort(byUpdatedDesc);
  const sortedOpen = [...open].sort(byUpdatedDesc);
  return [...sortedWip, ...sortedOpen].slice(0, limit);
}
