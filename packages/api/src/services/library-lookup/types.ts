import type { NormalisedBook } from '@nodea/shared';

/**
 * Source name for a metadata provider — matches `NormalisedBook.source`
 * and the keys of `NormalisedBook.providers`.
 */
export type ProviderName = NormalisedBook['source'];

/**
 * Adapter contract every provider implements. Adapters never throw on
 * "no result" — they return an empty array. They throw only on
 * unexpected failures (5xx, malformed JSON), which the dispatcher
 * catches per-provider so one broken source doesn't take down the
 * whole lookup.
 */
export interface ProviderAdapter {
  readonly name: ProviderName;
  /** Human-readable label for the admin dashboard. */
  readonly label: string;
  /** Whether this adapter is operational right now (e.g. Google Books
   * is `enabled: false` when no API key is configured). */
  readonly enabled: boolean;
  /** Does this provider require an API key in the server config? */
  readonly needsKey: boolean;
  /** When true, the admin health probe treats `0 results on the
   * universal test ISBN` as a hard failure (instead of a benign
   * "online but mute"). Used for scraping-based providers (Amazon)
   * where a 0-count on a guaranteed-present book means the HTML
   * structure changed and the regex parser is broken — the kind of
   * thing the operator absolutely needs to know about. */
  readonly strictProbe: boolean;
  /** ISO 639-1 prefix the provider's catalogue is restricted to.
   * Set on national-library SPARQL adapters (BNE = `es`) that have
   * no useful results for other languages. The dispatcher skips
   * the provider for queries whose language hint is set and
   * doesn't match. Issue #38.
   *
   * Unset (the default) means "always run, regardless of language" —
   * the right choice for multi-language catalogues (Open Library,
   * Google Books, Wikidata, Amazon) and for BNF, which holds
   * cross-language catalogue data. */
  readonly restrictsToLang?: string;
  byIsbn(isbn: string): Promise<NormalisedBook[]>;
  byQuery(query: string, lang?: string): Promise<NormalisedBook[]>;
}
