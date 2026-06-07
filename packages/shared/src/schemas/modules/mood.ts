/**
 * Mood module — encrypted payload schema.
 *
 * Cleartext JSON that lives inside the AES-GCM blob for one mood entry ;
 * the server only ever stores the ciphertext. Defined here (shared) so
 * the client refuses to encrypt malformed objects and tests can assert
 * round-trips. `z.looseObject` tolerates future/experimental fields so
 * old records keep decoding. One module per file — split out of the
 * former monolithic `modules.ts`, mirroring the per-flow auth schemas.
 */
import { z } from 'zod';

/**
 * Valid `moodScore` strings — Direction K · Sauge mood scale
 * (`très bas → très bon`). Stored as a string for forwards-compat
 * with legacy entries; the UI binds these to a 5-segment selector.
 */
export const MOOD_SCORE_VALUES = ['-2', '-1', '0', '1', '2'] as const;
export type MoodScore = (typeof MOOD_SCORE_VALUES)[number];

export const MoodPayloadSchema = z.looseObject({
  date: z.string().min(1),
  moodScore: z.string(),
  /**
   * Pre-Direction-K entries used to carry an emoji alongside the
   * note. The Sauge redesign drops it from the form, but old
   * records still hold a string here — kept optional + default
   * so existing payloads decrypt cleanly.
   */
  moodEmoji: z.string().optional().default(''),
  positive1: z.string().default(''),
  positive2: z.string().default(''),
  positive3: z.string().default(''),
  comment: z.string().default(''),
  question: z.string().optional(),
  answer: z.string().optional(),
});
export type MoodPayload = z.infer<typeof MoodPayloadSchema>;
