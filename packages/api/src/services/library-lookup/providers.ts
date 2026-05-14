import type { ProviderAdapter } from './types.ts';
import { openLibraryAdapter } from './openlibrary.ts';
import { googleBooksAdapter } from './googlebooks.ts';
import { bnfAdapter } from './bnf.ts';
import { wikidataAdapter } from './wikidata.ts';
import { bneAdapter } from './bne.ts';
import { amazonAdapter } from './amazon.ts';

/**
 * Provider order — controls (a) which adapters are queried at all,
 * and (b) the priority used by `mergeBooks` when fields collide.
 * Adapters are queried in **parallel** (`Promise.allSettled`); the
 * order only matters for the merge.
 *
 * Open Library and Google Books come first because they have
 * covers, summaries, and page counts. The SPARQL providers go
 * after — they fill in the gaps for niche / multilingual books
 * the commercial-ish providers don't cover well.
 */
export const PROVIDERS: readonly ProviderAdapter[] = [
  openLibraryAdapter,
  googleBooksAdapter,
  bnfAdapter,
  wikidataAdapter,
  bneAdapter,
  // Amazon is last on purpose: scraped HTML, the most fragile of the
  // bunch. The merge prefers fields from earlier providers when they
  // exist, so Amazon mostly fills gaps (covers, recent editions
  // missing from OL).
  amazonAdapter,
];
