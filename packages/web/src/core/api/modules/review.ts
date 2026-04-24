import { ReviewPayloadSchema } from '@nodea/shared';
import { createCollectionClient } from './collection-client.ts';

/** Yearly YearCompass-style reviews. Typically one per calendar year. */
export const reviewClient = createCollectionClient('review', ReviewPayloadSchema);
