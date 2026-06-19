import type { CanonicalStatus } from './types';

/** Cycle order for `nextStatus` and the iteration in the status
 *  filter chips. Open → wip → done → open. */
export const CANONICAL_STATUSES: ReadonlyArray<CanonicalStatus> = [
  'open',
  'wip',
  'done',
];
