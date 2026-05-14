import type { MoodScore } from '@nodea/shared';

import type { MoodEntry } from '../../Mood/lib/types';

/**
 * Lite shape of a Mood entry consumed by the Home blocks
 * (`MoodBlock`, `ToSeeList`). Two fields piggy-back on the
 * canonical `MoodEntry` via `Pick<>` so a rename in
 * `Mood/lib/types.ts` propagates here automatically ; the
 * `createdAt` shim stays Home-local because the canonical
 * `MoodEntry` doesn't carry a server timestamp (the
 * minimum-readable-surface design dropped per-record server
 * timestamps).
 */
export type MoodEntryLite = Pick<MoodEntry, 'dateIso' | 'score'> & {
  /** ISO timestamp used by `ToSeeList` to display `HH:MM` next
   *  to a checked Mood task. Currently set to `dateIso` by
   *  `projectMoodEntries` because no real timestamp survives
   *  to the client ; the field is kept for future plumbing
   *  (e.g. once we surface a per-record `createdAt`). */
  createdAt: string;
};

/**
 * Three-state goal status as the Home blocks read it. Legacy
 * values (`active` / `archived`) on the canonical
 * `CanonicalStatus` are mapped onto this narrower set by
 * `projectGoalEntries`, so `GoalEntryLite` is **not** derivable
 * from `GoalEntry` via `Pick<>` — a Pick would inherit the
 * wider `CanonicalStatus` and let stale legacy values leak into
 * Home tones. Keep the discriminated union local.
 */
export type GoalStatusLite = 'open' | 'wip' | 'done';

/**
 * Lite shape of a Goals entry consumed by `IntentionsBlock` and
 * the home page's « réalisés ces 12 mois » roll-up.
 * Locally defined rather than `Pick<GoalEntry, …>` because the
 * `status` field is a narrower union than `GoalEntry.status`
 * (see `GoalStatusLite` above).
 */
export interface GoalEntryLite {
  id: string;
  title: string;
  status: GoalStatusLite;
  thread: string;
  /** ISO `updatedAt` from the payload — used to keep recent
   *  goals on top when there's no other ordering signal. */
  updatedAt: string;
  /** ISO timestamp captured when the goal flipped to `done` ;
   *  `null` for never-done goals. Drives the homepage's
   *  « réalisés ces 12 mois » filter. */
  completedAt: string | null;
}

/**
 * Lite shape of a Library item consumed by `ReadingBlock`. The
 * block only ever sees items with `status === 'in_progress'`.
 *
 * Locally defined rather than `Pick<LibraryItem, …>` because
 * `author` is a derived display string (joined from the
 * `creators` array filtered to `role === 'author'`) — there's
 * no canonical `author` field to pick from.
 */
export interface LibraryReadingLite {
  id: string;
  title: string;
  author: string;
  /** Whether the user marked this book as a favourite — surfaced
   *  by an inline star on the home block. */
  isFavorite: boolean;
}

/** One cell of the 14-day mood strip rendered by `MoodBlock`. A
 *  cell without `score` renders as a faint outline so a missed
 *  day reads as a gap, not a zero. */
export interface MoodFriseCell {
  dateIso: string;
  score?: MoodScore;
  isToday: boolean;
}

/** Aggregate stats over the 14-day frise — shown next to the
 *  section heading. `avg` is `null` when no day in the window
 *  carried an entry, so the UI can render a placeholder instead
 *  of a numeric zero (which would falsely read as « neutre »). */
export interface MoodFriseStats {
  count: number;
  avg: number | null;
}

/**
 * Lite shape of a Journal entry consumed by `ToSeeList` (« Entrée
 * Journal aujourd'hui » row), `RecentJournal` (snippet preview),
 * and `JournalHeatmap` (year density). Just enough to know the
 * day, the thread, a content snippet, and the entry's id for a
 * « voir le journal » link.
 */
export interface JournalEntryLite {
  id: string;
  /** `YYYY-MM-DD` slice of the entry's payload date. */
  dateIso: string;
  thread: string;
  title: string | null;
  /** Raw content (post-decryption). Consumers truncate as needed —
   *  the projection doesn't pre-snippet so future use-cases (full
   *  text search, word-count) keep the data they need. */
  content: string;
}
