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
