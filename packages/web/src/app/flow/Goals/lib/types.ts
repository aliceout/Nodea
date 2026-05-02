/** Three-state status as the K UI surfaces it. The Zod schema's
 *  `GOAL_STATUS_VALUES` accepts legacy aliases (`active`,
 *  `archived`) — `normalizeStatus` collapses those down to the
 *  canonical trio so the UI doesn't have to render five colours
 *  for two real meanings. */
export type CanonicalStatus = 'open' | 'wip' | 'done';

/** Decrypted goal record + the page's id handle, plus client-side
 *  conveniences (`completedAt` ISO when status crossed into done,
 *  `updatedAt` from the in-payload timestamp the writer bumps on
 *  every save). */
export interface GoalEntry {
  id: string;
  date: string;
  title: string;
  note: string;
  status: CanonicalStatus;
  thread: string;
  /** ISO timestamp from the saved record's `updatedAt` payload
   *  field. Drives the « Récemment modifié » sort option. */
  updatedAt: string;
  /** ISO timestamp captured when the goal flipped to `done`,
   *  null otherwise. Pre-existing `done` records that never went
   *  through the new flow keep `null` here. */
  completedAt: string | null;
}

export type SortBy = 'date' | 'updated' | 'alpha';
