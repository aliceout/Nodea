/**
 * Cross-host relational remap for the Import/Export pipeline (issue
 * #155).
 *
 * WHAT — some child collections reference a parent record by its
 * SERVER id (`library_reviews.itemRid` → a `library_items` row,
 * `hrt_admin_logs.scheduleId` → `hrt_schedules`). On a same-account
 * restore the ids match, but on
 * a new account / fresh host the parents are recreated with NEW server
 * ids, so every reference dangles and the restore silently loses the
 * relationship (the review/log survives but points nowhere).
 *
 * HOW — instead of a new stored field, we reuse each parent's already
 * existing content key (`getNaturalKey`, the same key the dedup uses):
 *   - export: stamp each child with its parent's natural key under
 *     `PARENT_REF_KEY` (an export-only field, never stored);
 *   - import: recreate parents first, build `naturalKey → newServerId`,
 *     and rewrite each child's reference, then strip the carried key.
 *
 * WHERE — pure functions, no I/O. The two orchestrators
 * (`collect-modules.ts` at export, `restore-envelope.ts` at import)
 * supply the parent index and call these. Kept pure so the remap rules
 * (legacy passthrough, orphan-safety, optional clearing) are unit-
 * tested without the API (`relink.test.ts`).
 *
 * NON-OBVIOUS — a child is NEVER dropped. A required reference whose
 * parent can't be resolved keeps its original id (an orphan is
 * recoverable; a deleted record is not — and losing data is the one
 * outcome a backup must never produce). Old exports (no carried key)
 * pass through unchanged, i.e. exactly today's same-host behaviour.
 */
import type { ParentRef } from './types.ts';

/** Export-only field carrying a child's parent natural key. Stripped
 *  on import before the record is re-encrypted — it never lands in a
 *  stored payload. Double-underscore so it's visibly transient in the
 *  cleartext JSON export. */
export const PARENT_REF_KEY = '__parentKey';

/**
 * Defense-in-depth: drop the transient `__parentKey` from a raw payload
 * before it reaches a schema parse. `relinkParentRefs` already strips it
 * on the one production restore path, but the child schemas are
 * `z.looseObject` (they keep unknown keys), so any future importer that
 * bypasses relink would otherwise persist it into stored ciphertext.
 * Each child `normalizePayload` runs its input through this so the
 * storage boundary is self-defending regardless of caller.
 */
export function stripParentRefKey(
  p: Record<string, unknown>,
): Record<string, unknown> {
  if (!(PARENT_REF_KEY in p)) return p;
  const { [PARENT_REF_KEY]: _omit, ...rest } = p;
  return rest;
}

/**
 * EXPORT side. Stamp each child payload with its parent's natural key
 * so a later cross-host import can remap the reference. A child whose
 * parent id isn't in `idToKey` (already dangling, or parent absent) is
 * left untouched — nothing to stamp.
 */
export function stampParentKeys(
  children: ReadonlyArray<unknown>,
  ref: ParentRef,
  idToKey: ReadonlyMap<string, string>,
): unknown[] {
  return children.map((child) => {
    const rec = child as Record<string, unknown>;
    const parentId = rec[ref.field];
    if (typeof parentId !== 'string') return rec;
    const key = idToKey.get(parentId);
    if (key === undefined) return rec;
    return { ...rec, [PARENT_REF_KEY]: key };
  });
}

export interface RelinkResult {
  /** Children with their reference rewritten (or left as-is) and the
   *  carried key stripped — ready to create on the target host. */
  remapped: unknown[];
  /** Count of required references whose parent couldn't be resolved on
   *  the target host (kept as orphans, not dropped). For a warning. */
  unresolved: number;
}

/**
 * IMPORT side. Rewrite each child's parent reference to the parent's
 * NEW server id on this host, using the parent's carried natural key,
 * and strip the carried key.
 *
 *   - reference already a LIVE parent id on this host → left as-is (the
 *     same-host re-import path: nothing to remap). Critically this also
 *     preserves idempotency when two parents share a natural key — the
 *     child keeps its true parent rather than being rewritten to the
 *     `indexByKey` first-id-wins survivor (which would change the
 *     child's own dedup key and duplicate it);
 *   - else, carried key resolves → reference rewritten to the new id
 *     (the cross-host path: the carried id is the old host's, dead here);
 *   - else, carried key unresolved + optional ref → reference cleared;
 *   - else, carried key unresolved + required ref → original id kept
 *     (orphan, counted in `unresolved`) — never dropped;
 *   - no carried key (legacy export) → left exactly as-is.
 *
 * `liveParentIds` is the set of parent server ids that currently exist
 * on this host (from the parent's `listKeyIndex`).
 */
export function relinkParentRefs(
  children: ReadonlyArray<unknown>,
  ref: ParentRef,
  keyToNewId: ReadonlyMap<string, string>,
  liveParentIds: ReadonlySet<string>,
): RelinkResult {
  const remapped: unknown[] = [];
  let unresolved = 0;
  for (const child of children) {
    const rec = { ...(child as Record<string, unknown>) };
    const carried = rec[PARENT_REF_KEY];
    delete rec[PARENT_REF_KEY];
    const current = rec[ref.field];
    const refIsLive = typeof current === 'string' && liveParentIds.has(current);
    if (typeof carried === 'string' && !refIsLive) {
      const newId = keyToNewId.get(carried);
      if (newId !== undefined) {
        rec[ref.field] = newId;
      } else if (ref.optional) {
        delete rec[ref.field];
      } else {
        unresolved += 1;
      }
    }
    remapped.push(rec);
  }
  return { remapped, unresolved };
}

/** Set of parent server ids from a `{ id, key }` list — the "live
 *  parents on this host" used to skip needless rewrites. */
export function idSet(
  pairs: ReadonlyArray<{ id: string; key: string }>,
): Set<string> {
  return new Set(pairs.map((p) => p.id));
}

/** Invert a `{ id, key }` list to `id → key` (for export stamping).
 *  Ids are unique, so this is lossless even when two parents share a
 *  natural key (a content collision): each id still maps to its key. */
export function indexById(
  pairs: ReadonlyArray<{ id: string; key: string }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const { id, key } of pairs) m.set(id, key);
  return m;
}

/** Build `key → id` (for import rewriting). On a natural-key collision
 *  the first id wins, matching the dedup's "same key = one record"
 *  semantics. */
export function indexByKey(
  pairs: ReadonlyArray<{ id: string; key: string }>,
): Map<string, string> {
  const m = new Map<string, string>();
  for (const { id, key } of pairs) if (!m.has(key)) m.set(key, id);
  return m;
}
