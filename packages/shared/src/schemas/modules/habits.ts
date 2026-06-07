/**
 * Habits module — encrypted payload schemas (two collections).
 *
 * Cleartext JSON inside the AES-GCM blob ; the server only stores
 * ciphertext. Two payloads : an habit **item** (the definition) and an
 * habit **log** (one occurrence), linked client-side by `itemRid`.
 * Shared so the client validates before encrypting and tests assert
 * round-trips. `z.looseObject` tolerates future fields.
 */
import { z } from 'zod';

export const HABIT_CATEGORY_VALUES = [
  'sport',
  'santé',
  'créativité',
  'relation',
  'autre',
] as const;
export const HABIT_FREQUENCY_VALUES = ['daily', 'weekly', 'monthly', 'custom'] as const;

/** An habit definition (e.g. "Tennis", weekly, target 1). */
export const HabitsItemPayloadSchema = z.looseObject({
  title: z.string().min(1),
  category: z.enum(HABIT_CATEGORY_VALUES).default('autre'),
  frequency: z.enum(HABIT_FREQUENCY_VALUES).default('weekly'),
  target: z.number().int().positive().optional(),
  /** ISO 8601 duration, e.g. "P6M" for "6 months". */
  duration: z.string().optional(),
  startedAt: z.string().min(1),
  archived: z.boolean().default(false),
});
export type HabitsItemPayload = z.infer<typeof HabitsItemPayloadSchema>;

/** A single occurrence: "did Tennis on 2025-08-25". */
export const HabitsLogPayloadSchema = z.looseObject({
  date: z.string().min(1),
  /** Client-side identifier of the associated habits_items record. */
  itemRid: z.string().min(1),
  done: z.boolean().default(true),
});
export type HabitsLogPayload = z.infer<typeof HabitsLogPayloadSchema>;
