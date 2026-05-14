import {
  LibraryItemPayloadSchema,
  LibraryReviewPayloadSchema,
  LibraryCoverPayloadSchema,
} from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

/** Books in the library (Library is books-only — see doc Q1). */
export const libraryItemsClient = createCollectionClient(
  'library-items',
  LibraryItemPayloadSchema,
);

/** Notes / extracts attached to a library item. */
export const libraryReviewsClient = createCollectionClient(
  'library-reviews',
  LibraryReviewPayloadSchema,
);

/** Cover blob (base64 image), separated from the item payload to keep
 * the items table light. Looked up by `coverRid` on the item. */
export const libraryCoversClient = createCollectionClient(
  'library-covers',
  LibraryCoverPayloadSchema,
);
