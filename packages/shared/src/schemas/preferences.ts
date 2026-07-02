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
 * theme is `light`; the dark-mode counterpart is `backgroundShadeDark`.
 * Each shade overrides `--color-k-bg` and `--color-k-bg2` via a
 * `data-bg-shade` attribute on `<html>`. See `dirk.css` for the
 * actual colour values.
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
 * Dark-mode background shade — the dark-side mirror of
 * `BackgroundShade`. Stored separately so a user's light pick and dark
 * pick are independent (flipping theme never overwrites the other).
 * Takes effect only when the resolved theme is `dark`, via a distinct
 * `data-bg-shade-dark` attribute on `<html>`. `graphite` is the default
 * warm-paper-at-night surface. See `dirk.css` for the colour values.
 */
export const BackgroundShadeDarkSchema = z.enum([
  'graphite',
  'onyx',
  'obsidian',
  'forest',
  'taupe',
]);
export type BackgroundShadeDark = z.infer<typeof BackgroundShadeDarkSchema>;

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
 * Goals: the default grouping axis + sort the module opens on, the status
 * pre-selected for a new goal, and whether to pre-fill the current year on
 * create. The grouping/sort SEED the initial filter state on open — the sidebar
 * toggles still override per session (same « seed, never lock » posture as the
 * view modes). Accept-only; the UI clamps unknown values to its own tuples.
 */
export const GoalsGroupByPreferenceSchema = z.enum(['year', 'thread']);
export type GoalsGroupByPreference = z.infer<typeof GoalsGroupByPreferenceSchema>;

export const GoalsSortByPreferenceSchema = z.enum(['date', 'updated', 'alpha']);
export type GoalsSortByPreference = z.infer<typeof GoalsSortByPreferenceSchema>;

export const GoalsDefaultStatusSchema = z.enum(['open', 'wip']);

/** Cycle: hormone-curve reference profile. `off` hides the tab ; the
 *  others pick which textbook pattern to draw (natal cycle / masculinising
 *  HRT). No feminising profile — a transfeminine body has no menstrual
 *  cycle, so it has no place in a cycle-tracking module. */
export const CycleHormoneProfileSchema = z.enum(['off', 'natal', 'masc']);
export type CycleHormoneProfile = z.infer<typeof CycleHormoneProfileSchema>;
export type GoalsDefaultStatus = z.infer<typeof GoalsDefaultStatusSchema>;

/**
 * Mood: where an optional composer block (the « question du jour », the three
 * positives) is offered — in the main questionnaire, tucked inside the
 * expandable drawer, or not at all. The score (« note du jour ») and the free
 * « mot du jour » always sit in the main form and aren't configurable.
 * Absent ⇒ 'accordion' (the question also honours the legacy
 * `moodOfferDailyQuestion`: false ⇒ 'off'). See `Mood/lib/placements.ts`.
 */
export const MoodSectionPlacementSchema = z.enum(['form', 'accordion', 'off']);
export type MoodSectionPlacement = z.infer<typeof MoodSectionPlacementSchema>;

/**
 * Mood: which block leads each row in the entries LIST — the three positives,
 * the free « mot du jour » (`comment`), or the « question du jour ». The other
 * two follow in the canonical order (positives → comment → question). A display
 * concern only (the composer order is fixed); absent ⇒ 'positives'. See
 * `Mood/lib/placements.ts` (`moodEntryOrder`).
 */
export const MoodEntryLeadSchema = z.enum(['positives', 'comment', 'question']);
export type MoodEntryLead = z.infer<typeof MoodEntryLeadSchema>;

/**
 * Journal: default grouping the module opens on (the sidebar toggle still
 * overrides per session). Absent ⇒ 'month'.
 */
export const JournalGroupByPreferenceSchema = z.enum(['month', 'thread']);
export type JournalGroupByPreference = z.infer<typeof JournalGroupByPreferenceSchema>;

/**
 * Library: default catalogue grouping axis. Mirrors the web-side
 * `LIBRARY_GROUP_BY_VALUES` tuple (`Library/lib/grouping.ts`); the UI clamps on
 * read so an axis added there later degrades gracefully. Absent ⇒ 'status'.
 */
export const LibraryGroupByPreferenceSchema = z.enum([
  'status',
  'author',
  'year',
  'tag',
  'publisher',
  'collection',
]);
export type LibraryGroupByPreference = z.infer<typeof LibraryGroupByPreferenceSchema>;

/** Library: status pre-selected when adding a new book. Mirrors
 *  `LIBRARY_STATUS_VALUES`. Absent ⇒ 'planned'. */
export const LibraryDefaultStatusSchema = z.enum([
  'planned',
  'in_progress',
  'finished',
  'abandoned',
]);
export type LibraryDefaultStatus = z.infer<typeof LibraryDefaultStatusSchema>;

/**
 * HRT: default Analyses target-band goal (health-sensitive — leaks transition
 * direction, so encrypted like every pref). Mirrors `HrtGoal`. Absent ⇒ none
 * (bands off, the current opt-in-only behaviour).
 */
export const HrtTargetGoalPreferenceSchema = z.enum(['feminizing', 'masculinizing']);
export type HrtTargetGoalPreference = z.infer<typeof HrtTargetGoalPreferenceSchema>;

/**
 * HRT: default time window for the Administration / Analyses lists. Mirrors the
 * `DateRangeFilter` presets (minus 'custom', which needs explicit dates).
 * Absent ⇒ 'all'.
 */
export const HrtDateRangePreferenceSchema = z.enum(['all', '30d', '3m', '6m', '12m']);
export type HrtDateRangePreference = z.infer<typeof HrtDateRangePreferenceSchema>;

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
/**
 * WebDAV connect-form input. Client-only — the server never sees these (they're
 * sealed into the encrypted preferences blob like every cloud credential), but
 * the schema lives here next to `CloudBackupSchema` so the webdav credential
 * shape has a single home. `baseUrl` accepts a host with or without scheme; the
 * provider normalises it (adds `https://` if missing, strips a trailing slash or
 * a pasted `…/remote.php/…` tail).
 */
export const WebdavCredentialsSchema = z.object({
  baseUrl: z
    .string()
    .min(1)
    // Accept "cloud.example.com" or "https://cloud.example.com" — valid as long
    // as it parses once a scheme is ensured (the provider prepends https://).
    .refine((s) => {
      const v = s.trim();
      try {
        new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
        return true;
      } catch {
        return false;
      }
    }),
  username: z.string().min(1),
  appPassword: z.string().min(1),
  /** Optional destination folder, relative to the user's files root (empty ⇒
   *  root). The provider creates it on connect if it doesn't exist. */
  folder: z.string().optional(),
});
export type WebdavCredentials = z.infer<typeof WebdavCredentialsSchema>;

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
    folder: z.string().optional(),
    lastBackupAt: z.number().optional(),
  }),
]);
export type CloudBackup = z.infer<typeof CloudBackupSchema>;

export const UserPreferencesPayloadSchema = z.looseObject({
  theme: ThemePreferenceSchema.optional(),
  language: LanguagePreferenceSchema.optional(),
  backgroundShade: BackgroundShadeSchema.optional(),
  backgroundShadeDark: BackgroundShadeDarkSchema.optional(),
  libraryViewMode: LibraryViewModeSchema.optional(),
  goalsViewMode: GoalsViewModeSchema.optional(),
  goalsGroupBy: GoalsGroupByPreferenceSchema.optional(),
  goalsSortBy: GoalsSortByPreferenceSchema.optional(),
  goalsDefaultStatus: GoalsDefaultStatusSchema.optional(),
  /** Goals: pre-fill the current calendar year on a new goal. Absent ⇒ false. */
  goalsPrefillYear: z.boolean().optional(),
  /** Mood: open with the frise (heatmap) collapsed. Absent ⇒ false (expanded). */
  moodChartCollapsed: z.boolean().optional(),
  /** Mood: offer the « question du jour » prompt on new entries. Absent ⇒ true.
   *  @deprecated superseded by `moodQuestionPlacement`; still READ as a fallback
   *  so blobs written before the placement setting keep their behaviour
   *  (false ⇒ 'off'). No longer written. */
  moodOfferDailyQuestion: z.boolean().optional(),
  /** Mood: placement of the « question du jour » block. Absent ⇒ derived from
   *  `moodOfferDailyQuestion` (false ⇒ 'off', else 'accordion'). */
  moodQuestionPlacement: MoodSectionPlacementSchema.optional(),
  /** Mood: placement of the three-positives block. Absent ⇒ 'accordion'. */
  moodPositivesPlacement: MoodSectionPlacementSchema.optional(),
  /** Mood: which block leads each entry row in the list. Absent ⇒ 'positives'. */
  moodEntryLead: MoodEntryLeadSchema.optional(),
  /** Cycle: hormone-curve reference profile (or « off » to hide the tab). Absent ⇒ 'natal'.
   *  `.catch` degrades a legacy value dropped from the enum (e.g. the removed
   *  'fem') to the default rather than failing the whole prefs parse. */
  cycleHormoneProfile: CycleHormoneProfileSchema.optional().catch(undefined),
  /** Cycle: show the same-day Mood score at the end of each entry row
   *  (cross-reference Mood by date). Absent ⇒ true (shown). */
  cycleShowMoodNote: z.boolean().optional(),
  journalGroupBy: JournalGroupByPreferenceSchema.optional(),
  /** Journal: show the « Il y a quelques années » memory panel. Absent ⇒ true. */
  journalShowOnThisDay: z.boolean().optional(),
  /** Journal: open with the frise (heatmap) collapsed. Absent ⇒ false (expanded). */
  journalChartCollapsed: z.boolean().optional(),
  libraryDefaultGroupBy: LibraryGroupByPreferenceSchema.optional(),
  libraryDefaultStatus: LibraryDefaultStatusSchema.optional(),
  /** Library: default lookup search language (BCP-47-ish code, e.g. 'fr').
   *  Absent ⇒ the app UI language. */
  librarySearchLang: z.string().min(2).max(8).optional(),
  /** Review: section ids the user has turned OFF in the wizard + reader.
   *  Absent / empty ⇒ all sections shown. */
  reviewHiddenSections: z.array(z.string().min(1).max(64)).optional(),
  /** HRT: molecule pre-selected in the Synthèse dose chart. Absent ⇒ most-logged. */
  hrtDefaultMolecule: z.string().min(1).max(128).optional(),
  hrtDefaultTargetGoal: HrtTargetGoalPreferenceSchema.optional(),
  /** HRT: preferred display unit per marker key (e.g. `{ estradiol: 'pmol/L' }`).
   *  Absent keys fall back to each marker's canonical / most-logged unit. */
  hrtUnitByMarker: z
    .record(z.string().min(1).max(64), z.string().min(1).max(32))
    .optional(),
  hrtDefaultDateRange: HrtDateRangePreferenceSchema.optional(),
  /** Home: card ids the user has hidden (hero / journalHeatmap / mood / goals).
   *  Absent / empty ⇒ all four shown. */
  homeHiddenCards: z.array(z.string().min(1).max(64)).optional(),
  dismissedAnnouncements: DismissedAnnouncementsSchema.optional(),
  /**
   * Rotation counter for the derived encrypted-backup phrase. NOT a
   * secret — just a version mixed into the HMAC that derives the .age
   * seal phrase (see `core/crypto/backup-phrase.ts`). Absent ⇒ 1.
   * Bumping it yields a fresh phrase for FUTURE exports; existing .age
   * files keep the phrase from the version they were sealed under.
   */
  backupPhraseVersion: z.number().int().positive().optional(),
  /**
   * The `backupPhraseVersion` the user has SEEN + confirmed via the
   * transcription quiz (the backup-phrase gate, `BackupPhrasePanel`). The
   * export/backup options on the Data tab unlock only when this equals the
   * current `backupPhraseVersion`. Absent ⇒ never confirmed. Set by the `/backup`
   * ceremony and by the gate; rotating the phrase (bumping the version) re-closes
   * the gate until the new phrase is confirmed.
   */
  backupPhraseConfirmedVersion: z.number().int().positive().optional(),
  /** Connected cloud-backup provider + its sealed credential (see
   *  `CloudBackupSchema`). Absent ⇒ no cloud backup configured. */
  cloudBackup: CloudBackupSchema.optional(),
});
export type UserPreferencesPayload = z.infer<typeof UserPreferencesPayloadSchema>;
