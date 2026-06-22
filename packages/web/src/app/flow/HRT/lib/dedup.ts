/**
 * Pure dedup analysis for HRT admin logs (extracted from DedupPanel,
 * REFACTO-08). No React / no I/O — the panel owns the fetch, the
 * deletion pool, and the UI ; this just computes the deletion plan, so
 * the grouping rule is unit-testable in isolation.
 *
 * Scope: only entries with a non-empty `scheduleId` participate (manual
 * logs with identical fields might be intentional). The grouping key is
 * `(scheduleId, date, time, product, dose)` ; within each group of size
 * > 1 the oldest by `payload.updatedAt` is kept and the rest are queued
 * for deletion.
 */
import type { HrtAdminLogPayload } from '@nodea/shared';

export interface AdminEntry {
  id: string;
  payload: HrtAdminLogPayload;
}

export interface AnalysisResult {
  /** Number of duplicate groups (distinct doses materialised >1 time). */
  groupCount: number;
  /** Total rows that would be deleted (sum of group sizes − 1). */
  duplicateCount: number;
  /** IDs to delete. The kept row of each group is implicit. */
  toDelete: string[];
}

/** Build the dedup key from a payload. Only materialised entries (with a
 *  `scheduleId`) participate ; everything else returns null. */
function dedupKey(payload: HrtAdminLogPayload): string | null {
  if (!payload.scheduleId) return null;
  return [
    payload.scheduleId,
    String(payload.date).slice(0, 10),
    payload.time ?? '',
    payload.product ?? '',
    String(payload.dose ?? ''),
  ].join('::');
}

/** Group entries by dedup key ; for each group of size > 1, keep the
 *  oldest (lowest `payload.updatedAt`) and queue the rest for deletion. */
export function analyse(entries: ReadonlyArray<AdminEntry>): AnalysisResult {
  const groups = new Map<string, AdminEntry[]>();
  for (const e of entries) {
    const key = dedupKey(e.payload);
    if (!key) continue;
    const bucket = groups.get(key) ?? [];
    bucket.push(e);
    groups.set(key, bucket);
  }
  let groupCount = 0;
  const toDelete: string[] = [];
  for (const bucket of groups.values()) {
    if (bucket.length <= 1) continue;
    groupCount += 1;
    const sorted = [...bucket].sort((a, b) =>
      (a.payload.updatedAt ?? '').localeCompare(b.payload.updatedAt ?? ''),
    );
    for (let i = 1; i < sorted.length; i += 1) {
      toDelete.push(sorted[i]!.id);
    }
  }
  return { groupCount, duplicateCount: toDelete.length, toDelete };
}
