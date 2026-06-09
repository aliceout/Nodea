import { z } from 'zod';

/**
 * Envelope for the encrypted user preferences blob — same 1:1 shape
 * as `modules_config`. The server only handles the wrapper; the inner
 * payload (see `UserPreferencesPayloadSchema`) is parsed client-side
 * after AES-GCM decryption.
 *
 * Body caps mirror modules-config : 64-char IV (AES-GCM IV is 16
 * base64 chars, the cap is paranoid headroom) and 32 KB payload
 * (preferences are a handful of enums + occasional booleans — even
 * with future expansion they should not approach this ceiling).
 */
export const UserPreferencesBodySchema = z.object({
  cipherIv: z.string().min(1).max(64),
  payload: z.string().min(1).max(32 * 1024),
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
