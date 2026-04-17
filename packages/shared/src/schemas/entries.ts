import { z } from 'zod';

const Base64ish = z.string().min(1);

/** Initial guard value on record creation. */
export const INIT_GUARD = 'init';

/** Promoted guard: "g_" + at least 32 hex chars (HMAC-SHA-256 → 64 chars). */
export const PromotedGuardSchema = z.string().regex(/^g_[a-f0-9]{32,}$/);

/** Any valid guard (init or promoted). */
export const GuardSchema = z.union([z.literal(INIT_GUARD), PromotedGuardSchema]);
export type GuardValue = z.infer<typeof GuardSchema>;

/**
 * Create-entry payload.
 *
 * - `sid` is the anonymous per-module user id (module_user_id).
 * - `cipher_iv` and `payload` are the AES-GCM wrapping; opaque to the server.
 * - `guard` MUST be `"init"` on creation — the client cannot compute the
 *   stable HMAC guard without the record id, which the server assigns.
 */
export const CreateEntryBodySchema = z.object({
  sid: z.string().min(1).max(128),
  cipher_iv: Base64ish,
  payload: Base64ish,
  guard: z.literal(INIT_GUARD),
});
export type CreateEntryBody = z.infer<typeof CreateEntryBodySchema>;

/**
 * Update payload.
 *
 * Used for both content updates and the one-time guard promotion from
 * `"init"` to `"g_..."`. The server enforces that a promoted guard cannot
 * change afterwards.
 */
export const UpdateEntryBodySchema = z.object({
  cipher_iv: Base64ish.optional(),
  payload: Base64ish.optional(),
  guard: PromotedGuardSchema.optional(),
});
export type UpdateEntryBody = z.infer<typeof UpdateEntryBodySchema>;

/** Public view of an entry — `guard` is deliberately absent. */
export const EntryViewSchema = z.object({
  id: z.string(),
  module_user_id: z.string(),
  cipher_iv: Base64ish,
  payload: Base64ish,
  created_at: z.string(),
  updated_at: z.string(),
});
export type EntryView = z.infer<typeof EntryViewSchema>;

/** Modules-config payload — 1:1 on user_id, no guard/sid. */
export const ModulesConfigBodySchema = z.object({
  cipher_iv: Base64ish,
  payload: Base64ish,
});
export type ModulesConfigBody = z.infer<typeof ModulesConfigBodySchema>;

/**
 * Known collection names. Keeping this in shared prevents drift between
 * the API route factory and the web API client.
 */
export const COLLECTION_NAMES = [
  'mood',
  'goals',
  'passage',
  'habits-items',
  'habits-logs',
  'library-items',
  'library-reviews',
  'review',
] as const;
export type CollectionName = (typeof COLLECTION_NAMES)[number];
