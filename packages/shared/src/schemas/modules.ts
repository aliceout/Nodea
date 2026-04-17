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

export const MoodPayloadSchema = z
  .object({
    date: z.string().min(1),
    mood_score: z.string(),
    mood_emoji: z.string(),
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

export const GOAL_STATUS_VALUES = ['active', 'done', 'archived'] as const;
export const GoalsPayloadSchema = z
  .object({
    date: z.string().default(''),
    title: z.string().min(1),
    note: z.string().default(''),
    status: z.enum(GOAL_STATUS_VALUES).default('active'),
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
// Library — two collections (items + reviews)
// ---------------------------------------------------------------------

export const LIBRARY_TYPE_VALUES = ['book', 'movie', 'tv', 'doc'] as const;
export const LIBRARY_PROVIDER_VALUES = ['openlibrary', 'googlebooks', 'tmdb'] as const;
export const LIBRARY_STATUS_VALUES = [
  'planned',
  'in_progress',
  'finished',
  'abandoned',
] as const;

/** A work in the library (book, movie, …). */
export const LibraryItemPayloadSchema = z
  .object({
    type: z.enum(LIBRARY_TYPE_VALUES),
    provider: z.enum(LIBRARY_PROVIDER_VALUES).optional(),
    external_id: z.string().optional(),
    title: z.string().min(1),
    creators: z.array(z.string()).default([]),
    year: z.number().int().optional(),
    language: z.string().optional(),
    cover_url: z.string().optional(),
    status: z.enum(LIBRARY_STATUS_VALUES).default('planned'),
    started_at: z.string().optional(),
    finished_at: z.string().optional(),
    rating: z.number().min(0).max(5).optional(),
    tags: z.array(z.string()).default([]),
  })
  .passthrough();
export type LibraryItemPayload = z.infer<typeof LibraryItemPayloadSchema>;

/** A reading note attached to a library_items record. */
export const LibraryReviewPayloadSchema = z
  .object({
    date: z.string().min(1),
    item_rid: z.string().min(1),
    note: z.string().min(1),
    page: z.number().int().positive().optional(),
    snippet: z.string().optional(),
  })
  .passthrough();
export type LibraryReviewPayload = z.infer<typeof LibraryReviewPayloadSchema>;

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
