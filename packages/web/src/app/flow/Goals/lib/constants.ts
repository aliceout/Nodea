import type { CanonicalStatus, SortBy } from './types';

/** Cycle order for `nextStatus` and the iteration in the status
 *  filter chips. Open → wip → done → open. */
export const CANONICAL_STATUSES: ReadonlyArray<CanonicalStatus> = [
  'open',
  'wip',
  'done',
];

/** Tailwind classes for the inline `<StatusPill>` button. Three
 *  tones — open is hairline neutral, wip is sage-soft, done is
 *  filled sage. Hover states picked so the cycle affordance reads
 *  on every state. */
export const STATUS_TONE: Record<CanonicalStatus, string> = {
  open: 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
  wip: 'border-accent-soft bg-accent-soft text-accent-deep hover:border-accent hover:text-accent-deep',
  done: 'border-accent bg-accent text-white hover:bg-accent-hover hover:border-accent-hover',
};

/** FR display label for each canonical status. Used by the pill
 *  text, the aria-label, the title tooltip, and the sidebar
 *  status-filter chips. */
export const STATUS_LABEL: Record<CanonicalStatus, string> = {
  open: 'ouvert',
  wip: 'en cours',
  done: 'terminé',
};

/** Short labels for the sort-by chips in the side column. */
export const SORT_LABEL: Record<SortBy, string> = {
  date: 'Date',
  updated: 'Récent',
  alpha: 'A→Z',
};
