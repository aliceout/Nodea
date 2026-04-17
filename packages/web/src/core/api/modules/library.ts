import { LibraryItemPayloadSchema, LibraryReviewPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

/** Works in the library: books, movies, TV, docs. */
export const libraryItemsClient = createCollectionClient('library-items', LibraryItemPayloadSchema);

/** Reading notes attached to a library work. */
export const libraryReviewsClient = createCollectionClient(
  'library-reviews',
  LibraryReviewPayloadSchema,
);
