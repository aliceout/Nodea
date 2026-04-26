import { z } from 'zod';

/**
 * Payload shapes for the three implemented modules.
 *
 * These Zod schemas describe the **cleartext** JSON that lives inside the
 * AES-GCM payload blob. The server never sees them (it only stores the
 * ciphertext), but having them here lets the TypeScript client refuse to
 * encrypt malformed objects and lets tests assert round-trips.
 *
 * `.passthrough()` is used so additional experimental fields don't break
 * existing records — we refuse obviously missing fields but tolerate
 * future extensions.
 */

// ---------------------------------------------------------------------
// Mood
// ---------------------------------------------------------------------

/**
 * Valid `mood_score` strings — Direction K · Sauge mood scale
 * (`très bas → très bon`). Stored as a string for forwards-compat
 * with legacy entries; the UI binds these to a 5-segment selector.
 */
export const MOOD_SCORE_VALUES = ['-2', '-1', '0', '1', '2'] as const;
export type MoodScore = (typeof MOOD_SCORE_VALUES)[number];

export const MoodPayloadSchema = z
  .object({
    date: z.string().min(1),
    mood_score: z.string(),
    /**
     * Pre-Direction-K entries used to carry an emoji alongside the
     * note. The Sauge redesign drops it from the form, but old
     * records still hold a string here — kept optional + default
     * so existing payloads decrypt cleanly.
     */
    mood_emoji: z.string().optional().default(''),
    positive1: z.string().default(''),
    positive2: z.string().default(''),
    positive3: z.string().default(''),
    comment: z.string().default(''),
    question: z.string().optional(),
    answer: z.string().optional(),
  })
  .passthrough();
export type MoodPayload = z.infer<typeof MoodPayloadSchema>;

// ---------------------------------------------------------------------
// Goals
// ---------------------------------------------------------------------

/**
 * Goal lifecycle — matches the legacy tri-state cycle that the history
 * view toggles through: open → wip → done → open.
 * `active` / `archived` are accepted as legacy archive aliases for
 * forwards-compat with older import files.
 */
export const GOAL_STATUS_VALUES = ['open', 'wip', 'done', 'active', 'archived'] as const;
export const GoalsPayloadSchema = z
  .object({
    date: z.string().default(''),
    title: z.string().min(1),
    note: z.string().default(''),
    status: z.enum(GOAL_STATUS_VALUES).default('open'),
    thread: z.string().default(''),
  })
  .passthrough();
export type GoalsPayload = z.infer<typeof GoalsPayloadSchema>;

// ---------------------------------------------------------------------
// Passage
// ---------------------------------------------------------------------

export const PassagePayloadSchema = z
  .object({
    type: z.literal('passage.entry').default('passage.entry'),
    date: z.string().min(1),
    thread: z.string().default(''),
    title: z.string().nullable().default(null),
    content: z.string().min(1),
  })
  .passthrough();
export type PassagePayload = z.infer<typeof PassagePayloadSchema>;

// ---------------------------------------------------------------------
// Habits — two collections (items + logs)
// ---------------------------------------------------------------------

export const HABIT_CATEGORY_VALUES = [
  'sport',
  'santé',
  'créativité',
  'relation',
  'autre',
] as const;
export const HABIT_FREQUENCY_VALUES = ['daily', 'weekly', 'monthly', 'custom'] as const;

/** An habit definition (e.g. "Tennis", weekly, target 1). */
export const HabitsItemPayloadSchema = z
  .object({
    title: z.string().min(1),
    category: z.enum(HABIT_CATEGORY_VALUES).default('autre'),
    frequency: z.enum(HABIT_FREQUENCY_VALUES).default('weekly'),
    target: z.number().int().positive().optional(),
    /** ISO 8601 duration, e.g. "P6M" for "6 months". */
    duration: z.string().optional(),
    started_at: z.string().min(1),
    archived: z.boolean().default(false),
  })
  .passthrough();
export type HabitsItemPayload = z.infer<typeof HabitsItemPayloadSchema>;

/** A single occurrence: "did Tennis on 2025-08-25". */
export const HabitsLogPayloadSchema = z
  .object({
    date: z.string().min(1),
    /** Client-side identifier of the associated habits_items record. */
    item_rid: z.string().min(1),
    done: z.boolean().default(true),
  })
  .passthrough();
export type HabitsLogPayload = z.infer<typeof HabitsLogPayloadSchema>;

// ---------------------------------------------------------------------
// Library — three collections (items + reviews + covers)
// ---------------------------------------------------------------------

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
export const LibraryProvidersSchema = z
  .object({
    openlibrary: z.string().optional(),
    googlebooks: z.string().optional(),
    amazon: z.string().optional(),
    isbn13: z.string().optional(),
    isbn10: z.string().optional(),
  })
  .passthrough();
export type LibraryProviders = z.infer<typeof LibraryProvidersSchema>;

/**
 * Creator — author / translator / illustrator / etc. Convention for
 * `name` is `<Prénom> <NOM en MAJUSCULES>` (validated 2026-04-26).
 * `role` is left as a free-form string so we don't trip on imports
 * with unusual roles ("préface", "postface", "illustrations").
 */
export const LibraryCreatorSchema = z
  .object({
    name: z.string().min(1),
    role: z.string().default('author'),
  })
  .passthrough();
export type LibraryCreator = z.infer<typeof LibraryCreatorSchema>;

export const LibrarySeriesSchema = z
  .object({
    name: z.string().min(1),
    position: z.number().int().positive().optional(),
    of: z.number().int().positive().optional(),
  })
  .passthrough();
export type LibrarySeries = z.infer<typeof LibrarySeriesSchema>;

/**
 * A book in the library. See `documentation/Modules/Library.md` §3.1
 * for the field semantics.
 */
export const LibraryItemPayloadSchema = z
  .object({
    type: z.enum(LIBRARY_TYPE_VALUES).default('book'),
    title: z.string().min(1),

    providers: LibraryProvidersSchema.optional(),

    creators: z.array(LibraryCreatorSchema).default([]),
    year: z.number().int().optional(),
    language: z.string().optional(),
    original_language: z.string().optional(),
    page_count: z.number().int().positive().optional(),
    publisher: z.string().optional(),
    /** Collection éditoriale (e.g. "Folio classique", "Pléiade",
     * "Babel"). Distinct from `series` which is a multi-volume work.
     * BNF has the cleanest data on this. */
    collection: z.string().optional(),
    summary: z.string().optional(),
    series: LibrarySeriesSchema.optional(),

    /** rid of the matching `library_covers_entries` row, or null. */
    cover_rid: z.string().nullable().default(null),

    status: z.enum(LIBRARY_STATUS_VALUES).default('planned'),
    format: z.enum(LIBRARY_FORMAT_VALUES).default('unknown'),
    started_at: z.string().nullable().default(null),
    finished_at: z.string().nullable().default(null),
    current_page: z.number().int().nonnegative().nullable().default(null),
    rating: z.number().min(0).max(5).nullable().default(null),
    tags: z.array(z.string()).default([]),
    is_favorite: z.boolean().default(false),
  })
  .passthrough();
export type LibraryItemPayload = z.infer<typeof LibraryItemPayloadSchema>;

/**
 * A note or extract attached to a library item. `kind: "quote"` is
 * the heir of the old Passage module (passages copied from a book) ;
 * `kind: "note"` covers everything else (in-progress reflection,
 * fiche-bilan, impression…).
 */
export const LibraryReviewPayloadSchema = z
  .object({
    item_rid: z.string().min(1),
    date: z.string().min(1),
    kind: z.enum(LIBRARY_REVIEW_KIND_VALUES).default('note'),
    title: z.string().nullable().default(null),
    content: z.string().min(1),
    page: z.number().int().positive().nullable().default(null),
    spoiler: z.boolean().default(false),
  })
  .passthrough();
export type LibraryReviewPayload = z.infer<typeof LibraryReviewPayloadSchema>;

/**
 * Cover blob — stored in its own collection so the items payload
 * stays small (a base64 cover can run 30–100 KB). The whole blob is
 * encrypted client-side just like any other module payload.
 */
export const LibraryCoverPayloadSchema = z
  .object({
    item_rid: z.string().min(1),
    mime: z.string().min(1),
    blob_b64: z.string().min(1),
    fetched_from: z.string().nullable().default(null),
    fetched_at: z.string().nullable().default(null),
  })
  .passthrough();
export type LibraryCoverPayload = z.infer<typeof LibraryCoverPayloadSchema>;

// ---------------------------------------------------------------------
// Review — one rich yearly entry (YearCompass-inspired)
// ---------------------------------------------------------------------

/**
 * The Review payload is a deep structure (`last_year` / `next_year` /
 * `closing`, each with nested objects and arrays). Constraining every
 * field here would bloat the schema without adding safety — the UI
 * builds the object step by step and the server only stores the
 * ciphertext. We keep the top-level envelope tight and let the nested
 * content through as `unknown`-ish records.
 *
 * See `documentation/Modules/Review.md` for the full expected shape.
 */
export const ReviewPayloadSchema = z
  .object({
    year: z.number().int(),
    last_year: z.record(z.string(), z.unknown()).optional(),
    next_year: z.record(z.string(), z.unknown()).optional(),
    closing: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();
export type ReviewPayload = z.infer<typeof ReviewPayloadSchema>;
