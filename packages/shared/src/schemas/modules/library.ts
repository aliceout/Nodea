/**
 * Library module — encrypted payload schemas (three collections).
 *
 * Cleartext JSON inside the AES-GCM blob ; the server only stores
 * ciphertext. Three payloads : a library **item** (a book), a **review**
 * (note / quote attached to an item), and a **cover** (its own
 * collection so the item payload stays small). Shared so the client
 * validates before encrypting and tests assert round-trips.
 * `z.looseObject` tolerates future fields. See
 * `documentation/Modules/Library.md` for field semantics.
 */
import { z } from 'zod';

/**
 * Library is **books only** (per design decision 2026-04-26 / Q1).
 * The `type` discriminator stays on the item so a future audiovisual
 * sibling module could share the schema, but Library itself only
 * accepts `book`.
 */
export const LIBRARY_TYPE_VALUES = ['book'] as const;
export type LibraryType = (typeof LIBRARY_TYPE_VALUES)[number];

export const LIBRARY_STATUS_VALUES = [
  'planned',
  'in_progress',
  'finished',
  'abandoned',
] as const;
export type LibraryStatus = (typeof LIBRARY_STATUS_VALUES)[number];

export const LIBRARY_FORMAT_VALUES = ['paper', 'ebook', 'audio', 'unknown'] as const;
export type LibraryFormat = (typeof LIBRARY_FORMAT_VALUES)[number];

export const LIBRARY_REVIEW_KIND_VALUES = ['quote', 'note'] as const;
export type LibraryReviewKind = (typeof LIBRARY_REVIEW_KIND_VALUES)[number];

/**
 * External-provider identity for a library item — used to fetch
 * metadata and to dedupe at import time. Every key is optional;
 * an item with all fields empty is fine (manual entry).
 */
export const LibraryProvidersSchema = z.looseObject({
  openlibrary: z.string().optional(),
  googlebooks: z.string().optional(),
  amazon: z.string().optional(),
  isbn13: z.string().optional(),
  isbn10: z.string().optional(),
});
export type LibraryProviders = z.infer<typeof LibraryProvidersSchema>;

/**
 * Creator — author / translator / illustrator / etc. Convention for
 * `name` is `<Prénom> <NOM en MAJUSCULES>` (validated 2026-04-26).
 * `role` is left as a free-form string so we don't trip on imports
 * with unusual roles ("préface", "postface", "illustrations").
 */
export const LibraryCreatorSchema = z.looseObject({
  name: z.string().min(1),
  role: z.string().default('author'),
});
export type LibraryCreator = z.infer<typeof LibraryCreatorSchema>;

export const LibrarySeriesSchema = z.looseObject({
  name: z.string().min(1),
  position: z.number().int().positive().optional(),
  of: z.number().int().positive().optional(),
});
export type LibrarySeries = z.infer<typeof LibrarySeriesSchema>;

/**
 * A book in the library. See `documentation/Modules/Library.md` §3.1
 * for the field semantics.
 */
export const LibraryItemPayloadSchema = z.looseObject({
  type: z.enum(LIBRARY_TYPE_VALUES).default('book'),
  title: z.string().min(1),

  providers: LibraryProvidersSchema.optional(),

  creators: z.array(LibraryCreatorSchema).default([]),
  year: z.number().int().optional(),
  language: z.string().optional(),
  originalLanguage: z.string().optional(),
  publisher: z.string().optional(),
  /** Collection éditoriale (e.g. "Folio classique", "Pléiade",
   * "Babel"). Distinct from `series` which is a multi-volume work.
   * BNF has the cleanest data on this. */
  collection: z.string().optional(),
  summary: z.string().optional(),
  series: LibrarySeriesSchema.optional(),

  /** rid of the matching `library_covers_entries` row, or null. */
  coverRid: z.string().nullable().default(null),

  status: z.enum(LIBRARY_STATUS_VALUES).default('planned'),
  format: z.enum(LIBRARY_FORMAT_VALUES).default('unknown'),
  startedAt: z.string().nullable().default(null),
  finishedAt: z.string().nullable().default(null),
  rating: z.number().min(0).max(5).nullable().default(null),
  tags: z.array(z.string()).default([]),
  isFavorite: z.boolean().default(false),
});
export type LibraryItemPayload = z.infer<typeof LibraryItemPayloadSchema>;

/**
 * A note or extract attached to a library item. `kind: "quote"` is
 * a short excerpt copied from the book (typically with a page
 * reference) ; `kind: "note"` covers everything else (in-progress
 * reflection, fiche-bilan, impression…).
 */
export const LibraryReviewPayloadSchema = z.looseObject({
  itemRid: z.string().min(1),
  date: z.string().min(1),
  kind: z.enum(LIBRARY_REVIEW_KIND_VALUES).default('note'),
  title: z.string().nullable().default(null),
  content: z.string().min(1),
  page: z.number().int().positive().nullable().default(null),
  spoiler: z.boolean().default(false),
});
export type LibraryReviewPayload = z.infer<typeof LibraryReviewPayloadSchema>;

/**
 * Cover blob — stored in its own collection so the items payload
 * stays small (a base64 cover can run 30–100 KB). The whole blob is
 * encrypted client-side just like any other module payload.
 */
export const LibraryCoverPayloadSchema = z.looseObject({
  itemRid: z.string().min(1),
  mime: z.string().min(1),
  blobB64: z.string().min(1),
  fetchedFrom: z.string().nullable().default(null),
  fetchedAt: z.string().nullable().default(null),
});
export type LibraryCoverPayload = z.infer<typeof LibraryCoverPayloadSchema>;
