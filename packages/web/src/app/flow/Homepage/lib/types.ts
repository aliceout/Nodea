import type { MoodScore } from '@nodea/shared';

/** Lite shape of a Mood entry consumed by the Home blocks
 *  (`MoodBlock`, `ToSeeList`). Stays narrow on purpose — the
 *  full `MoodEntry` (positives, comment, formatted label) lives
 *  inside the Mood module and doesn't need to leak into Home. */
export interface MoodEntryLite {
  dateIso: string;
  score: MoodScore;
  /** ISO timestamp from the server — used by `ToSeeList` to
   *  display `HH:MM` next to a checked Mood task. */
  createdAt: string;
}

/** Three-state goal status as the Home blocks read it. Legacy
 *  values (`active` / `archived`) are mapped onto this set by
 *  `useGoalEntries` so the home block doesn't render a fourth
 *  tone. */
export type GoalStatusLite = 'open' | 'wip' | 'done';

/** Lite shape of a Goals entry consumed by `IntentionsBlock`. */
export interface GoalEntryLite {
  id: string;
  title: string;
  status: GoalStatusLite;
  thread: string;
  /** ISO `updatedAt` from the payload — used to keep recent
   *  goals on top when there's no other ordering signal. */
  updatedAt: string;
}

/** Lite shape of a Library item consumed by `ReadingBlock`. The
 *  block only ever sees items with `status === 'in_progress'`. */
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

/** Static « À voir » row mocked while Library + Habits aren't
 *  wired through. Removed once the matching modules go live. */
export interface MockTask {
  label: string;
  meta: string;
  doneAt: string;
}
