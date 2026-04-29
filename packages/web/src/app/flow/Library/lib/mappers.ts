import type {
  LibraryCoverPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
} from '@nodea/shared';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import type { LibraryItem, LibraryReview } from './types';

/** Flatten a decrypted item record into the `{ id, ...payload }`
 *  shape the page passes around. */
export function itemFromRecord(
  r: DecryptedRecord<LibraryItemPayload>,
): LibraryItem {
  return { id: r.id, ...r.payload };
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
 * cover row's id (which is the value stored as `cover_rid` on the
 * matching item). The data URL is `data:<mime>;base64,<blob_b64>`
 * — directly usable as `<img src>`. No URL.createObjectURL overhead
 * (which would require revocation on unmount).
 */
export function buildCoverMap(
  records: DecryptedRecord<LibraryCoverPayload>[],
): Map<string, string> {
  const map = new Map<string, string>();
  for (const r of records) {
    const url = `data:${r.payload.mime};base64,${r.payload.blob_b64}`;
    map.set(r.id, url);
  }
  return map;
}
