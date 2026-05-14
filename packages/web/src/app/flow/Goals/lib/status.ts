import { CANONICAL_STATUSES } from './constants';
import type { CanonicalStatus } from './types';

/** Cycle the status one step forward in the canonical order
 *  `open → wip → done → open`. Pure function — used by the
 *  pill's onClick to drive the transition. */
export function nextStatus(current: CanonicalStatus): CanonicalStatus {
  const i = CANONICAL_STATUSES.indexOf(current);
  return CANONICAL_STATUSES[(i + 1) % CANONICAL_STATUSES.length] ?? 'open';
}
