import type {
  GoalsPayload,
  JournalPayload,
  LibraryItemPayload,
  MoodPayload,
  MoodScore,
} from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import { VALID_STATUS as GOAL_VALID_STATUS } from '@/app/flow/Goals/lib/mappers';
import { VALID_SCORES as MOOD_VALID_SCORES } from '@/app/flow/Mood/lib/mappers';

import type {
  GoalEntryLite,
  GoalStatusLite,
  JournalEntryLite,
  LibraryReadingLite,
  MoodEntryLite,
} from './types';

/**
 * Project decrypted Mood records onto the home Lite shape.
 *
 * Server-side timestamps are gone (minimum-readable-surface
 * design) — the user-facing `payload.date` is the only date we
 * have. Records with a missing or malformed date are dropped
 * (rather than guessed at), as are records with an unexpected
 * mood score. The lite `createdAt` falls back to `dateIso` so
 * downstream tie-breaking still has something to compare on.
 *
 * Pure : no I/O, no global clock, no React. Suitable for Vitest.
 */
export function projectMoodEntries(
  records: ReadonlyArray<DecryptedRecord<MoodPayload>>,
): MoodEntryLite[] {
  const out: MoodEntryLite[] = [];
  for (const r of records) {
    const p = r.payload;
    if (!p.date || !/^\d{4}-\d{2}-\d{2}/.test(p.date)) continue;
    if (!MOOD_VALID_SCORES.has(p.moodScore)) continue;
    const dateIso = p.date.slice(0, 10);
    out.push({
      dateIso,
      score: p.moodScore as MoodScore,
      createdAt: dateIso,
    });
  }
  return out;
}

/**
 * Project decrypted Goals records onto the home Lite shape.
 *
 * Drops records with an empty title and records whose status is
 * outside the canonical set. Legacy aliases (`active` → `open`,
 * `archived` → `done`) are mapped onto the three-state
 * representation the home block knows about, so we don't render
 * a fourth tone.
 *
 * Pure : no I/O, no global clock, no React.
 */
export function projectGoalEntries(
  records: ReadonlyArray<DecryptedRecord<GoalsPayload>>,
): GoalEntryLite[] {
  const out: GoalEntryLite[] = [];
  for (const r of records) {
    const p = r.payload;
    const title = p.title?.trim() ?? '';
    if (!title) continue;
    const raw = (p.status ?? 'open') as string;
    if (!GOAL_VALID_STATUS.has(raw)) continue;
    const status: GoalStatusLite =
      raw === 'active'
        ? 'open'
        : raw === 'archived'
          ? 'done'
          : (raw as GoalStatusLite);
    out.push({
      id: r.id,
      title,
      status,
      thread: p.thread ?? '',
      // `payload.updatedAt` is the in-payload timestamp the
      // Goals writer bumps on every save (server-side
      // timestamps were dropped).
      updatedAt: p.updatedAt,
      // `completedAt` is captured by the Goals page when a goal
      // flips into `done` ; null otherwise. The homepage uses
      // it to filter « réalisés ces 12 mois ».
      completedAt: p.completedAt ?? null,
    });
  }
  return out;
}

/**
 * Project decrypted Library items onto the « En cours de
 * lecture » Lite shape, keeping only items whose status is
 * `in_progress`. Authors are derived from the `creators` array,
 * filtered to the `author` role (or no role at all), trimmed,
 * deduped on the way in by `Array.filter(Boolean)`, and joined
 * with `, ` for display.
 *
 * Pure : no I/O, no global clock, no React.
 */
export function projectLibraryReadings(
  records: ReadonlyArray<DecryptedRecord<LibraryItemPayload>>,
): LibraryReadingLite[] {
  const out: LibraryReadingLite[] = [];
  for (const r of records) {
    const p = r.payload;
    if (p.status !== 'in_progress') continue;
    const title = p.title?.trim();
    if (!title) continue;
    const author =
      p.creators
        ?.filter((c) => !c.role || c.role === 'author')
        .map((c) => c.name.trim())
        .filter(Boolean)
        .join(', ') ?? '';
    out.push({
      id: r.id,
      title,
      author,
      isFavorite: p.isFavorite ?? false,
    });
  }
  return out;
}

/**
 * Project decrypted Journal records onto the home Lite shape.
 * Drops records with a missing / malformed `date`. The output is
 * sorted newest-first so the homepage's « last entry » lookups
 * are an O(1) `[0]` read.
 *
 * Pure : no I/O, no global clock, no React.
 */
export function projectJournalEntries(
  records: ReadonlyArray<DecryptedRecord<JournalPayload>>,
): JournalEntryLite[] {
  const out: JournalEntryLite[] = [];
  for (const r of records) {
    const p = r.payload;
    if (!p.date || !/^\d{4}-\d{2}-\d{2}/.test(p.date)) continue;
    out.push({
      id: r.id,
      dateIso: p.date.slice(0, 10),
      thread: p.thread ?? '',
      title: p.title ?? null,
      content: p.content ?? '',
    });
  }
  out.sort((a, b) => b.dateIso.localeCompare(a.dateIso));
  return out;
}
