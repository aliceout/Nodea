import { GOAL_STATUS_VALUES, type GoalsPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { buildSearchHaystack } from '@/lib/text-search';

import type { CanonicalStatus, GoalEntry } from './types';

/** Set of status strings the schema accepts. Used by
 *  `normalizeStatus` to short-circuit unknown values back to
 *  `'open'` rather than letting them through unchecked. Exported
 *  so Homepage can reuse it for its read-only projection — same
 *  source of truth, no drift risk if the schema's status domain
 *  ever changes. */
export const VALID_STATUS: ReadonlySet<string> = new Set<string>(GOAL_STATUS_VALUES);

/**
 * Normalise a raw `payload.status` to one of the three canonical
 * states the K UI surfaces. The schema accepts legacy aliases
 * (`active` / `archived`) — they map onto `open` / `done`. Unknown
 * values fall back to `open` defensively (rather than crashing or
 * showing a fifth pill colour).
 */
export function normalizeStatus(raw: string | undefined): CanonicalStatus {
  if (!raw || !VALID_STATUS.has(raw)) return 'open';
  if (raw === 'active') return 'open';
  if (raw === 'archived') return 'done';
  return raw as CanonicalStatus;
}

/** Flatten a decrypted goal record into the `{ id, ...payload-
 *  derived fields }` shape the page hands around. Strings default
 *  to `''` so React renders cleanly without `undefined` checks at
 *  every read. */
export function recordToEntry(record: DecryptedRecord<GoalsPayload>): GoalEntry {
  const p = record.payload;
  const title = p.title ?? '';
  const note = p.note ?? '';
  const thread = p.thread ?? '';
  return {
    id: record.id,
    date: p.date ?? '',
    title,
    note,
    status: normalizeStatus(p.status),
    thread,
    // `payload.updatedAt` is the in-payload timestamp the writer
    // bumps on every save — server-side timestamps were dropped in
    // the minimum-readable-surface refactor.
    updatedAt: p.updatedAt,
    completedAt: typeof p.completedAt === 'string' ? p.completedAt : null,
    searchHaystack: buildSearchHaystack([title, note, thread]),
  };
}
