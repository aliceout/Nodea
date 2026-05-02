import type { CollectionName } from '@nodea/shared/schemas/entries';
import {
  moodEntries,
  goalsEntries,
  passageEntries,
  habitsItemsEntries,
  habitsLogsEntries,
  libraryItemsEntries,
  libraryReviewsEntries,
  libraryCoversEntries,
  reviewEntries,
  type EntryTable,
} from './db/schema.ts';

export interface CollectionDef {
  name: CollectionName;
  table: EntryTable;
}

/**
 * Single source of truth for every encrypted-entry collection.
 *
 * Adding a new module = adding one entry here. The app composer iterates
 * this array to mount routes, so any collection that exists in the DB but
 * is missing from this list will have no routes at all (fail-closed),
 * and any collection mounted here automatically gets the full
 * requireUser + requireGuard plumbing.
 *
 * This is the structural guarantee the roadmap asks for: impossible to
 * register a collection without guard validation.
 */
export const COLLECTIONS: readonly CollectionDef[] = [
  { name: 'mood', table: moodEntries },
  { name: 'goals', table: goalsEntries },
  { name: 'passage', table: passageEntries },
  { name: 'habits-items', table: habitsItemsEntries },
  { name: 'habits-logs', table: habitsLogsEntries },
  { name: 'library-items', table: libraryItemsEntries },
  { name: 'library-reviews', table: libraryReviewsEntries },
  { name: 'library-covers', table: libraryCoversEntries },
  { name: 'review', table: reviewEntries },
];
