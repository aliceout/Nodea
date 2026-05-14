import { z } from 'zod';

const Base64ish = z.string().min(1);

/**
 * Envelope for the encrypted user preferences blob — same 1:1 shape
 * as `modules_config`. The server only handles the wrapper; the inner
 * payload (see `UserPreferencesPayloadSchema`) is parsed client-side
 * after AES-GCM decryption.
 */
export const UserPreferencesBodySchema = z.object({
  cipherIv: Base64ish,
  payload: Base64ish,
});
export type UserPreferencesBody = z.infer<typeof UserPreferencesBodySchema>;

/**
 * Decrypted preferences payload. Both fields are optional so clients
 * rolling out new preferences over time don't invalidate old blobs.
 */
export const ThemePreferenceSchema = z.enum(['light', 'dark', 'system']);
export type ThemePreference = z.infer<typeof ThemePreferenceSchema>;

export const LanguagePreferenceSchema = z.enum(['fr', 'en']);
export type LanguagePreference = z.infer<typeof LanguagePreferenceSchema>;

export const UserPreferencesPayloadSchema = z
  .object({
    theme: ThemePreferenceSchema.optional(),
    language: LanguagePreferenceSchema.optional(),
  })
  .passthrough();
export type UserPreferencesPayload = z.infer<typeof UserPreferencesPayloadSchema>;
