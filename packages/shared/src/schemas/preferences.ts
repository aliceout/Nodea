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

/**
 * Goals catalogue rendering mode. Same encrypted-prefs posture as
 * `libraryViewMode` — survives device hops and never lands in
 * localStorage (which would leak « this user has Goals enabled »
 * to anyone with browser-storage access on the machine).
 *
 *   - `list`   : the legacy grouped-rows layout (one entry per row,
 *                inline status pill + hover actions).
 *   - `cards`  : a responsive card grid (1/2/3/4 columns from mobile
 *                to xl-desktop), one card per goal.
 *
 * Accept-only ; the UI clamps to the local `GOALS_VIEW_MODES` tuple
 * defensively in case a future client version writes a value this
 * release doesn't know about.
 */
export const GoalsViewModeSchema = z.enum(['list', 'cards']);
export type GoalsViewMode = z.infer<typeof GoalsViewModeSchema>;

/**
 * Per-user list of admin-announcement ids the user has dismissed
 * from the Homepage. Stored encrypted alongside the other
 * preferences so the server never sees which announcements a
 * specific user has interacted with (consistent with the privacy
 * posture for module ids + reading-mode preferences).
 *
 * The list is append-only on the client. Server-side, an
 * announcement can also drop off the live feed (active=false,
 * outside its start/end window, or simply deleted), at which
 * point this list still references its id — that's fine, the
 * client filter just never matches it again. A future garbage
 * collection pass could prune stale ids, but the 32 KB
 * preferences cap leaves ~900 UUIDs of headroom which is well
 * past anything a user would ever accumulate.
 */
export const DismissedAnnouncementsSchema = z.array(z.string().min(1).max(128));
export type DismissedAnnouncements = z.infer<typeof DismissedAnnouncementsSchema>;

/**
 * Cloud-backup connection (ADR-0017). The per-user credential for the connected
 * provider, sealed HERE under the main key — never plaintext on the server.
 * Auto-backup pushes the already-E2E-encrypted `.age` straight from the browser,
 * so this credential is the one new secret and lives only in this blob.
 *
 * A discriminated union on `provider`, because each cloud has a different auth
 * shape: Dropbox keeps an OAuth refresh token, pCloud a non-expiring access
 * token (+ its API region host), WebDAV the server URL + an app-password.
 * `lastBackupAt` (unix ms; absent ⇒ never) is common to all and drives the
 * on-unlock 24 h staleness check.
 */
export const CloudBackupSchema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('dropbox'),
    refreshToken: z.string().min(1),
    lastBackupAt: z.number().optional(),
  }),
  z.object({
    provider: z.literal('pcloud'),
    accessToken: z.string().min(1),
    apiHost: z.string().min(1),
    lastBackupAt: z.number().optional(),
  }),
  z.object({
    provider: z.literal('webdav'),
    baseUrl: z.string().min(1),
    username: z.string().min(1),
    appPassword: z.string().min(1),
    lastBackupAt: z.number().optional(),
  }),
]);
export type CloudBackup = z.infer<typeof CloudBackupSchema>;

export const UserPreferencesPayloadSchema = z.looseObject({
  theme: ThemePreferenceSchema.optional(),
  language: LanguagePreferenceSchema.optional(),
  backgroundShade: BackgroundShadeSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
  goalsViewMode: GoalsViewModeSchema.optional(),
  dismissedAnnouncements: DismissedAnnouncementsSchema.optional(),
  /**
   * Rotation counter for the derived encrypted-backup phrase. NOT a
   * secret — just a version mixed into the HMAC that derives the .age
   * seal phrase (see `core/crypto/backup-phrase.ts`). Absent ⇒ 1.
   * Bumping it yields a fresh phrase for FUTURE exports; existing .age
   * files keep the phrase from the version they were sealed under.
   */
  backupPhraseVersion: z.number().int().positive().optional(),
  /** Connected cloud-backup provider + its sealed credential (see
   *  `CloudBackupSchema`). Absent ⇒ no cloud backup configured. */
  cloudBackup: CloudBackupSchema.optional(),
});
export type UserPreferencesPayload = z.infer<typeof UserPreferencesPayloadSchema>;
