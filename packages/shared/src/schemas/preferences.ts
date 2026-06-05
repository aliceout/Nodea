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

/**
 * Light-mode background shade. Only takes effect when the resolved
 * theme is `light` — dark mode keeps its single warm-paper-at-night
 * surface. Each shade overrides `--color-k-bg` and `--color-k-bg2`
 * via a `data-bg-shade` attribute on `<html>`. See `dirk.css` for
 * the actual colour values.
 */
export const BackgroundShadeSchema = z.enum([
  'cream',
  'alabaster',
  'ivory',
  'pearl',
  'pebble',
]);
export type BackgroundShade = z.infer<typeof BackgroundShadeSchema>;

export const UserPreferencesPayloadSchema = z.looseObject({
  theme: ThemePreferenceSchema.optional(),
  language: LanguagePreferenceSchema.optional(),
  backgroundShade: BackgroundShadeSchema.optional(),
});
export type UserPreferencesPayload = z.infer<typeof UserPreferencesPayloadSchema>;
