import { GOAL_STATUS_VALUES, type GoalsPayload } from '@nodea/shared';

import type { DecryptedRecord } from '@/core/api/modules/collection-client';

import type { CanonicalStatus, GoalEntry } from './types';

/** Set of status strings the schema accepts. Used by
 *  `normalizeStatus` to short-circuit unknown values back to
 *  `'open'` rather than letting them through unchecked. */
const VALID_STATUS = new Set<string>(GOAL_STATUS_VALUES);

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
  return {
    id: record.id,
    date: p.date ?? '',
    title: p.title ?? '',
    note: p.note ?? '',
    status: normalizeStatus(p.status),
    thread: p.thread ?? '',
    // `payload.updated_at` is the in-payload timestamp the writer
    // bumps on every save — server-side timestamps were dropped in
    // the minimum-readable-surface refactor.
    updatedAt: p.updated_at,
    completedAt: typeof p.completed_at === 'string' ? p.completed_at : null,
  };
}
