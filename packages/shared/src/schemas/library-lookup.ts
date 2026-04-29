import { z } from 'zod';

/**
 * Normalised book metadata returned by any of the Library lookup
 * providers (Open Library, Google Books, BNF, Wikidata, BNE). The
 * server merges results from multiple sources into this single
 * shape — the client never has to know which provider supplied a
 * given field.
 *
 * Naming convention for `creators[].name`: `<Prénom> <NOM>` with the
 * lastname uppercased, normalised on insert into Library (cf.
 * `documentation/Modules/Library.md` §3.1). Adapters emit names in
 * this canonical form.
 */
export const NormalisedBookSchema = z.object({
  title: z.string().min(1),
  creators: z
    .array(
      z.object({
        name: z.string().min(1),
        role: z.string().default('author'),
      }),
    )
    .default([]),
  year: z.number().int().nullable().default(null),
  language: z.string().nullable().default(null),
  original_language: z.string().nullable().default(null),
  publisher: z.string().nullable().default(null),
  /** Collection éditoriale (e.g. "Folio classique"). */
  collection: z.string().nullable().default(null),
  summary: z.string().nullable().default(null),
  isbn13: z.string().nullable().default(null),
  isbn10: z.string().nullable().default(null),
  /** Best-effort format inference from provider metadata.
   * Only one of `paper | ebook | audio` is ever emitted; null
   * means the provider didn't carry a usable signal. */
  format: z.enum(['paper', 'ebook', 'audio']).nullable().default(null),
  /** Multi-volume series this book belongs to (e.g. "Les Misérables,
   * tome 2"). `position` and `of` are optional — usually only
   * `position` is known. */
  series: z
    .object({
      name: z.string().min(1),
      position: z.number().int().positive().nullable().default(null),
      of: z.number().int().positive().nullable().default(null),
    })
    .nullable()
    .default(null),
  /** Remote URL of the cover image — the client may download +
   * cache it as an encrypted blob via `library_covers_entries`. */
  cover_url: z.string().nullable().default(null),
  /** External identifiers, keyed by provider — used to dedupe and
   * to follow up with provider-specific URLs ("voir sur OL"). */
  providers: z
    .object({
      openlibrary: z.string().optional(),
      googlebooks: z.string().optional(),
      bnf: z.string().optional(),
      wikidata: z.string().optional(),
      bne: z.string().optional(),
      /** Amazon ASIN (also serves as ISBN-10 for older books). */
      amazon: z.string().optional(),
    })
    .partial()
    .default({}),
  /** Which provider's record contributed the bulk of this entry.
   * Useful for debugging "why is this field weird" / "qui dit ça". */
  source: z.enum(['openlibrary', 'googlebooks', 'bnf', 'wikidata', 'bne', 'amazon']),
});
export type NormalisedBook = z.infer<typeof NormalisedBookSchema>;

/** ISBN lookup body — straightforward 10/13 digit identifier. */
export const LibraryLookupByIsbnBodySchema = z.object({
  isbn: z
    .string()
    .min(10)
    .max(20)
    .transform((s) => s.replace(/[\s-]/g, '')),
});
export type LibraryLookupByIsbnBody = z.infer<typeof LibraryLookupByIsbnBodySchema>;

/** Free-text query (title / author / mixed). */
export const LibraryLookupByQueryBodySchema = z.object({
  q: z.string().min(2).max(200),
  /** BCP 47 language hint (`fr`, `en`, `es`). When set, providers
   * with a per-language catalog (BNF for fr, BNE for es) are pushed
   * forward in the response order. */
  lang: z.string().min(2).max(10).optional(),
});
export type LibraryLookupByQueryBody = z.infer<typeof LibraryLookupByQueryBodySchema>;

/**
 * Lookup response — list of candidate books, ordered by likely
 * relevance. The first entry is the merged "best guess" when the
 * input is unambiguous (e.g. a valid ISBN that hits in multiple
 * providers); subsequent entries are alternatives the user can
 * pick from in the UI dropdown.
 */
export const LibraryLookupResponseSchema = z.object({
  results: z.array(NormalisedBookSchema),
  /** Names of providers that were queried for this lookup. The
   * client can show this for transparency ("résultats fournis
   * par : Open Library, Wikidata"). */
  queried: z.array(
    z.enum(['openlibrary', 'googlebooks', 'bnf', 'wikidata', 'bne', 'amazon']),
  ),
  /** Whether the result was served from cache (no external API
   * calls were made for this query). */
  cached: z.boolean(),
});
export type LibraryLookupResponse = z.infer<typeof LibraryLookupResponseSchema>;

/**
 * Streaming lookup snapshot — emitted by the NDJSON streaming
 * endpoint after each provider completes (success or failure).
 * Each snapshot carries the *current accumulated state* (deduped +
 * filtered), not just the new chunk, so the client can simply
 * replace its render list on every event.
 *
 * The `done` flag is `true` on the final snapshot only — the
 * client uses it to flip its loading indicator off. `errored`
 * accumulates per-provider failures so the UI can hint which
 * sources are down ("Open Library indisponible — réessaie").
 */
export const LibraryLookupStreamSnapshotSchema = z.object({
  results: z.array(NormalisedBookSchema),
  queried: z.array(
    z.enum(['openlibrary', 'googlebooks', 'bnf', 'wikidata', 'bne', 'amazon']),
  ),
  errored: z.array(
    z.object({
      provider: z.enum(['openlibrary', 'googlebooks', 'bnf', 'wikidata', 'bne', 'amazon']),
      message: z.string(),
    }),
  ),
  done: z.boolean(),
});
export type LibraryLookupStreamSnapshot = z.infer<typeof LibraryLookupStreamSnapshotSchema>;
