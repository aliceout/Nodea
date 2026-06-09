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

/**
 * Library catalogue rendering mode. Moved out of localStorage into
 * the encrypted preferences blob during the v2.8.0 audit cleanup :
 * the previous `nodea:library:viewMode` localStorage key revealed
 * « this user has been using Library » to anyone with browser-storage
 * access on the same machine. Per the cross-device-sync side benefit,
 * the chosen layout now follows the user across browsers.
 *
 * Accept-only ; the keystore reads these but the UI clamps to its own
 * `LIBRARY_VIEW_MODES` tuple defensively in case the blob carries an
 * unknown value from a future client version.
 */
export const LibraryViewModeSchema = z.enum([
  'list-plain',
  'list-cover',
  'table',
  'grid',
  'wall',
]);
export type LibraryViewMode = z.infer<typeof LibraryViewModeSchema>;

export const UserPreferencesPayloadSchema = z.looseObject({
  theme: ThemePreferenceSchema.optional(),
  language: LanguagePreferenceSchema.optional(),
  backgroundShade: BackgroundShadeSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
});
export type UserPreferencesPayload = z.infer<typeof UserPreferencesPayloadSchema>;
