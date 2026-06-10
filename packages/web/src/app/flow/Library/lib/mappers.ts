import type {
  LibraryCoverPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { buildSearchHaystack } from '@/lib/text-search';
import type { LibraryItem, LibraryReview } from './types';

/** Flatten a decrypted item record into the `{ id, ...payload }`
 *  shape the page passes around, plus a precomputed search haystack
 *  (title + creator names + tags) so the list filter doesn't
 *  re-normalise every field on every keystroke (audit 2026-06). */
export function itemFromRecord(
  r: DecryptedRecord<LibraryItemPayload>,
): LibraryItem {
  const p = r.payload;
  const searchHaystack = buildSearchHaystack([
    p.title,
    ...(p.creators ?? []).map((c) => c.name),
    ...(p.tags ?? []),
  ]);
  return { id: r.id, ...p, searchHaystack };
}

/** Flatten a decrypted review record into the `{ id, ...payload }`
 *  shape the page passes around. */
export function reviewFromRecord(
  r: DecryptedRecord<LibraryReviewPayload>,
): LibraryReview {
  return { id: r.id, ...r.payload };
}

/**
 * Turn the bulk-decrypted cover records into a Map keyed by the
 * cover row's id (which is the value stored as `coverRid` on the
 * matching item). The data URL is `data:<mime>;base64,<blobB64>`
 * — directly usable as `<img src>`. No URL.createObjectURL overhead
 * (which would require revocation on unmount).
 */
export function buildCoverMap(
  records: DecryptedRecord<LibraryCoverPayload>[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    const url = `data:${r.payload.mime};base64,${r.payload.blobB64}`;
    map.set(r.id, url);
  }
  return map;
}
