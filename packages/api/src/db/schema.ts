import {
  pgTable,
  pgEnum,
  text,
  timestamp,
  boolean,
  integer,
  bigint,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// ============================================================================
// Auth v2 — enums (shared by users and sessions tables)
//
// Introduced by Auth-Spec.md (see documentation/Auth-Spec.md §4). These
// enums materialise the new multi-factor auth model that supersedes the
// legacy Argon2id-direct flow described in Security.md §2. They are
// declared here at the top of the schema because both `users` and
// `sessions` reference them, and Drizzle requires enum values to exist
// before they're consumed by table builders.
// ============================================================================

/**
 * Per-user security policy. Drives which factors are required at login.
 *
 * - `password_or_passkey` — default. Either factor unlocks. The KEK is
 *   wrappable by both, so loss of one factor doesn't lock the user out
 *   as long as the other remains.
 * - `always_totp` — TOTP is required after password OR passkey verification.
 * - `maximum` — password + passkey + TOTP, all three. Activation invariant
 *   (Auth-Spec §6.1): TOTP must be enabled AND at least one PRF-capable
 *   passkey must be enrolled before this mode can be selected.
 *
 * Auto-downgrade rules (Auth-Spec §6.1):
 *   - TOTP disabled or bypassed → modes `always_totp` and `maximum`
 *     fall back to `password_or_passkey`.
 *   - Last PRF-capable passkey removed or bypassed → `maximum` falls
 *     back to `password_or_passkey`.
 */
export const securityMode = pgEnum('security_mode', [
  'password_or_passkey',
  'always_totp',
  'maximum',
]);

/**
 * Multi-step register state machine. Each new user transitions
 * pre_register → email_verified → password_set → recovery_set →
 * complete. The cleanup cron purges rows stuck in pre_register for
 * more than 24h (Auth-Spec §13.2).
 *
 * Lazy migration of legacy users (Auth-Spec §12) does NOT use this
 * state machine: a legacy user has register_state = 'complete' from
 * day one, and the migration cookie carries a separate session kind
 * `'migrate'` rather than abusing register_state.
 */
export const registerState = pgEnum('register_state', [
  'pre_register',
  'email_verified',
  'password_set',
  'recovery_set',
  'complete',
]);

/**
 * Session classification. `loadSession` uses the cookie name to pick
 * the expected kind and refuses any mismatch (Auth-Spec §5.2).
 *
 * - `full` — fully authenticated, can hit any non-auth route.
 * - `mfa_pending` — first factor verified, awaiting MFA. Scoped to
 *   `/auth/mfa/*` and `/auth/login/*` / `/auth/passkey/login/*` for
 *   stepped MFA (Auth-Spec §7.4).
 * - `register` — multi-step register in progress. Scoped to
 *   `/auth/register/*`, 24h TTL.
 * - `migrate` — legacy user authenticated via Argon2id, awaiting
 *   crypto migration to OPAQUE. Scoped to `/auth/migrate/*`, 30 min TTL.
 */
export const sessionKind = pgEnum('session_kind', [
  'full',
  'mfa_pending',
  'register',
  'migrate',
]);

/**
 * Auth factor type. Currently `passkey` only — TOTP and OPAQUE password
 * live in their own dedicated tables since their lifecycle differs
 * (TOTP can be disabled but stays enrollable; OPAQUE is 1:1 with users).
 */
export const authFactorKind = pgEnum('auth_factor_kind', ['passkey']);

/**
 * MFA factor a bypass request applies to. Both kinds share the same
 * 7-day-after-confirmation flow (Auth-Spec §7.8); the `factor` column
 * disambiguates which side-effect the bypass triggers at consumption.
 */
export const mfaFactor = pgEnum('mfa_factor', ['totp', 'passkey']);

/**
 * Email verification context. Same hashing/TTL/attempts policy across
 * kinds; the `kind` column drives which downstream transition fires
 * on success (register step 2 vs change-email step B).
 */
export const emailVerificationKind = pgEnum('email_verification_kind', [
  'register',
  'email_change',
]);

/**
 * Users — owners of encrypted data.
 *
 * Two cohabiting auth models during the migration window (cf.
 * Auth-Spec.md §12):
 *
 * - **Legacy (Argon2id direct)**: `password_hash`, `encryption_salt`,
 *   `encrypted_key`. The client derives a KEK from password + salt
 *   (Argon2id), unwraps `encrypted_key` → main key. These columns
 *   become NULL after a user's lazy migration to OPAQUE, and will
 *   be DROPped once 100% of users are migrated (Auth-Roadmap Phase 8).
 *
 * - **New (OPAQUE + multi-factor)**: `wrapped_main_key`,
 *   `wrapped_kek_password`, `wrapped_kek_recovery`,
 *   `recovery_code_hash`, plus the `security_mode` and
 *   `register_state` enums. The KEK is a random 32-byte secret
 *   wrapped multiple times (one wrap per factor), and the OPAQUE
 *   record itself lives in the `opaque_records` table.
 *
 * Both sets are nullable for now: legacy users keep the legacy fields
 * populated until they migrate, fresh users populate only the new
 * fields. After migration, `register_state = 'complete'` and the
 * legacy fields are NULL.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    /**
     * Public display name. Optional — users can register without setting
     * one. Uniqueness is enforced via a partial unique index so multiple
     * rows with NULL stay allowed.
     */
    username: text('username'),

    // --- Auth v2 (Phase 2D dropped the legacy Argon2id columns) -----------

    /** Email verification timestamp. NULL until step 2 of register
     *  (or rétro-vérif at lazy migration, cf. Auth-Spec §12.2). */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    /** Cooldown anchor for change-email (7 days). NULL until first
     *  change-email or destructive reset (Auth-Spec §13). */
    emailChangedAt: timestamp('email_changed_at', { withTimezone: true }),

    /** Per-user security policy — see `securityMode` enum docs above. */
    securityMode: securityMode('security_mode').notNull().default('password_or_passkey'),

    /** Multi-step register state machine — see `registerState` enum
     *  docs above.
     *
     *  **Transition note**: schema default is `'complete'` so that
     *  existing legacy users (and any new legacy register call before
     *  Phase 1 wires the multi-step flow) land in a coherent state.
     *  The new Phase 1 flow explicitly INSERTs with `'pre_register'`
     *  at step 1, overriding this default. After Phase 8 cleanup,
     *  this default should flip back to `'pre_register'` to match
     *  Auth-Spec §4.1. */
    registerState: registerState('register_state').notNull().default('complete'),

    /** AES-GCM ciphertext of the main key under the KEK. Set ONCE at
     *  register (or migration) and never re-wrapped. AAD = users.id. */
    wrappedMainKey: text('wrapped_main_key'),
    wrappedMainKeyIv: text('wrapped_main_key_iv'),

    /** AES-GCM ciphertext of the KEK under wk_password (HKDF of
     *  OPAQUE export_key). Re-wrapped on change-password. AAD =
     *  buildAAD([users.id, "password"]). */
    wrappedKekPassword: text('wrapped_kek_password'),
    wrappedKekPasswordIv: text('wrapped_kek_password_iv'),

    /** AES-GCM ciphertext of the KEK under wk_recovery (HKDF of
     *  BIP39 recovery code entropy). Re-wrapped on recovery code
     *  regeneration or recover-kek flow. AAD =
     *  buildAAD([users.id, "recovery"]). */
    wrappedKekRecovery: text('wrapped_kek_recovery'),
    wrappedKekRecoveryIv: text('wrapped_kek_recovery_iv'),

    /** SHA-256 hex of `recovery_bytes` (16-byte BIP39 entropy).
     *  Authorises the recover-kek flow without storing the code itself
     *  (128-bit entropy → uncrackable offline). Cf. Auth-Spec §7.7. */
    recoveryCodeHash: text('recovery_code_hash'),

    /** Set when the user explicitly acknowledges they've noted the
     *  recovery code at register step 4. Hard gate — without this we
     *  refuse to advance to register_state = 'recovery_set'. */
    recoveryAcknowledgedAt: timestamp('recovery_acknowledged_at', {
      withTimezone: true,
    }),

    // --- Existing onboarding fields (preserved as-is) ----------------------
    role: text('role', { enum: ['user', 'admin'] })
      .notNull()
      .default('user'),
    onboardingStatus: text('onboarding_status', { enum: ['pending', 'complete'] })
      .notNull()
      .default('pending'),
    onboardingVersion: text('onboarding_version').notNull().default('1'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('users_email_unique').on(t.email)],
);

/**
 * Sessions — server-side session records. The cookie carries only the
 * signed session id; rights and TTL live here so that logout /
 * revocation is immediate.
 *
 * Auth v2 extensions (cf. Auth-Spec.md §5.2): `kind` distinguishes
 * full / mfa_pending / register / migrate sessions, each scoped by
 * `loadSession` middleware to its allowed routes via cookie name.
 * `reauth_*_at` track the matrice de re-auth (Auth-Spec §6) for
 * privileged operations. `mfa_*_verified` flags accumulate during
 * stepped MFA in `mfa_pending` sessions until promotion to `full`.
 * `pending_webauthn_challenge` carries the per-session challenge
 * across `/auth/passkey/{enroll,login}/start` → `/finish` without
 * needing Redis (V1 single-instance assumption).
 */
export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Session classification — see `sessionKind` enum docs. */
    kind: sessionKind('kind').notNull().default('full'),

    // --- Re-auth fresh tracking (5 min window per Auth-Spec §5.3) ---------
    reauthPasswordAt: timestamp('reauth_password_at', { withTimezone: true }),
    reauthPasskeyAt: timestamp('reauth_passkey_at', { withTimezone: true }),

    // --- Stepped MFA accumulators (mfa_pending kind only, §7.4) -----------
    mfaPasswordVerified: boolean('mfa_password_verified').notNull().default(false),
    mfaPasskeyVerified: boolean('mfa_passkey_verified').notNull().default(false),
    mfaTotpVerified: boolean('mfa_totp_verified').notNull().default(false),

    // --- WebAuthn challenge persisted on session (TTL 5 min, §9.2) --------
    pendingWebauthnChallenge: text('pending_webauthn_challenge'),
    pendingWebauthnChallengeAt: timestamp('pending_webauthn_challenge_at', {
      withTimezone: true,
    }),

    // --- Audit metadata (Auth-Spec §7.10 GET /auth/sessions list) ---------
    /** Hash of the client IP (per-deployment salt) — never the IP itself,
     *  to keep IP-based correlation impossible from a leaked DB. */
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_expires_at_idx').on(t.expiresAt),
    index('sessions_user_kind_idx').on(t.userId, t.kind),
  ],
);

// ============================================================================
// Auth v2 — new tables (cf. Auth-Spec.md §4.1)
// ============================================================================

/**
 * OPAQUE registration records — 1:1 with users.
 *
 * Each row is the OPAQUE envelope produced at register (or migration).
 * The PK is `user_id` so we can swap envelopes atomically on
 * change-password / change-email / recover-kek without losing the
 * 1:1 invariant.
 *
 * `server_key_version` lets us track which version of the server
 * static key signed each envelope. V1 ships with version 1 only;
 * issue #39 covers the rotation mechanism (multiple versions stored
 * in a future `opaque_server_keys` table, lazy re-register at login).
 */
export const opaqueRecords = pgTable('opaque_records', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  envelope: text('envelope').notNull(),
  serverKeyVersion: integer('server_key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Auth factors — currently passkeys (WebAuthn).
 *
 * `wrapped_kek` (+ iv) holds the AES-GCM ciphertext of the KEK
 * under wk_passkey (HKDF of the PRF output). NULL when
 * `prf_supported = false` (login-only credential, can authenticate
 * but cannot unwrap data — the user must combine with password).
 * AAD = buildAAD([users.id, "passkey", credential_id]).
 *
 * `sign_count_strict` is true at enrollment and gets flipped to
 * false (per-credential, never back to true) after 3 consecutive
 * assertions where the authenticator returned `signCount = 0` —
 * Apple authenticators do this and we must not reject them.
 * Cf. Auth-Spec §9.6.
 */
export const authFactors = pgTable(
  'auth_factors',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: authFactorKind('kind').notNull(),
    credentialId: text('credential_id').notNull(),
    publicKey: text('public_key').notNull(),
    signCount: integer('sign_count').notNull().default(0),
    signCountStrict: boolean('sign_count_strict').notNull().default(true),
    transports: text('transports'),
    prfSupported: boolean('prf_supported').notNull().default(false),
    wrappedKek: text('wrapped_kek'),
    wrappedKekIv: text('wrapped_kek_iv'),
    label: text('label'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (t) => [
    uniqueIndex('auth_factors_credential_id_unique').on(t.credentialId),
    index('auth_factors_user_idx').on(t.userId),
  ],
);

/**
 * TOTP enrollment per user — 1:1.
 *
 * `secret` is stored in clear (RFC 6238 requires the server to verify
 * codes; cf. Auth-Spec §2.3 trade-off). `last_window` is the anti-replay
 * cursor (refuse any window <= stored). `enabled_at = NULL` means
 * enrollment is in progress and login does not count this user as
 * having TOTP.
 */
export const mfaTotp = pgTable('mfa_totp', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  secret: text('secret').notNull(),
  algo: text('algo').notNull().default('SHA1'),
  digits: integer('digits').notNull().default(6),
  period: integer('period').notNull().default(30),
  lastWindow: bigint('last_window', { mode: 'number' }),
  enabledAt: timestamp('enabled_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * TOTP backup codes. 10 generated at TOTP enrollment, hashed
 * (SHA-256) since each carries 130 bits of entropy. Single-use:
 * `used_at` is set at consumption and the row stays for audit.
 */
export const mfaTotpRecoveryCodes = pgTable(
  'mfa_totp_recovery_codes',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    codeHash: text('code_hash').notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
  },
  (t) => [index('mfa_totp_recovery_user_idx').on(t.userId)],
);

/**
 * MFA bypass requests — for users who lost TOTP or all passkeys.
 *
 * Flow: 7-day delay after the user clicks the email confirm link.
 * Eligibility check (cf. Auth-Spec §7.8) refuses the request when
 * multiple required factors are missing simultaneously (the
 * "perdu 2 trucs = niqué" policy). The unique partial index ensures
 * one user can never have two active requests at the same time
 * (cancelling stale ones first).
 *
 * `factor` disambiguates which side-effect fires at consumption:
 * `'totp'` → disable TOTP + purge backup codes; `'passkey'` →
 * delete all auth_factors of kind=passkey. Mode `maximum` then
 * auto-downgrades to `password_or_passkey` if applicable.
 */
export const mfaBypassRequests = pgTable(
  'mfa_bypass_requests',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    factor: mfaFactor('factor').notNull(),
    confirmTokenHash: text('confirm_token_hash').notNull(),
    cancelTokenHash: text('cancel_token_hash').notNull(),
    confirmedAt: timestamp('confirmed_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    cancelledAt: timestamp('cancelled_at', { withTimezone: true }),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // One active bypass per user, all factors combined. Forces serial
    // recovery and prevents quick chaining (passkey-then-TOTP in 96h).
    uniqueIndex('mfa_bypass_one_active')
      .on(t.userId)
      .where(sql`cancelled_at IS NULL AND consumed_at IS NULL`),
  ],
);

/**
 * Email verifications — 6-digit codes for register step 2 and
 * change-email step B. Codes hashed (SHA-256) with `attempts`
 * counter (max 5 before purge + force re-request) and a 10-minute
 * expiry. Cleanup cron purges consumed/expired rows (cf. §13.2).
 */
export const emailVerifications = pgTable(
  'email_verifications',
  {
    id: text('id').primaryKey(),
    userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }),
    email: text('email').notNull(),
    kind: emailVerificationKind('kind').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    consumedAt: timestamp('consumed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('email_verifications_email_idx').on(t.email)],
);

/**
 * Invites — email-bound registration tokens (Bitwarden-style).
 *
 * Admin enters an email, server generates a 32-byte random token,
 * stores its SHA-256 in `code_hash` (column kept for migration
 * brevity, semantic is now "token hash"), and emails the recipient
 * a link of the form `/register?invite=<token>`. The recipient
 * lands on the register page with their email pre-filled and locked
 * — submission is rejected if the email in the form doesn't match
 * the email this invite was issued for.
 *
 * Replaces the previous "invitation code" model where a clear code
 * was generated, displayed in /admin, and pasted by the user into
 * the register form. The new model removes the copy-paste step and
 * gates registration on email control proven via the link click.
 */
export const invites = pgTable(
  'invites',
  {
    id: text('id').primaryKey(),
    /** Recipient address — locked at issue time. Strict match at
     *  consumption: the user must sign up with EXACTLY this email. */
    email: text('email').notNull(),
    /** SHA-256 of the random token put in the activation link. The
     *  column name `code_hash` is preserved for schema brevity even
     *  though the semantic shifted from "code hash" to "token hash". */
    codeHash: text('code_hash').notNull(),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    usedBy: text('used_by').references(() => users.id, { onDelete: 'set null' }),
    usedAt: timestamp('used_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('invites_code_hash_unique').on(t.codeHash),
    // Lookups by email when admin asks "is there a pending invite
    // for foo@bar.com" or when register validates the strict match.
    index('invites_email_idx').on(t.email),
  ],
);

/**
 * Application-wide settings keyed/value table.
 *
 * V1 only stores `open_registration: 'true' | 'false'` (default
 * 'false' if absent — defensive: an admin must opt in). Future
 * settings (TOTP requirement, public announcements toggle, etc.)
 * land here too without a schema change.
 *
 * Values are stored as text. Boolean settings parse 'true' / 'false';
 * future structured settings can JSON-encode and parse on read.
 */
export const appSettings = pgTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  updatedBy: text('updated_by').references(() => users.id, { onDelete: 'set null' }),
});

/**
 * Password-reset tokens. Stored hashed (same pattern as invites) with
 * a short expiry. Consuming a token is atomic:
 *   - the row is looked up by `token_hash`
 *   - the transaction purges every user-owned encrypted row (see
 *     `/auth/reset` handler) because resetting the password means the
 *     user lost their main key — old ciphertexts become unreadable
 *   - the password hash + envelope are replaced with fresh values
 *   - `used_at` is set so the token can't be replayed.
 *
 * Rate limiting on the public request route protects against email
 * enumeration; the route itself always returns 200 whether or not the
 * email belongs to a user.
 */
export const passwordResetTokens = pgTable(
  'password_reset_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    usedAt: timestamp('used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('password_reset_tokens_token_hash_unique').on(t.tokenHash),
    index('password_reset_tokens_user_id_idx').on(t.userId),
  ],
);

/**
 * Announcements — server-side public feed curated by admins. Content
 * is not E2E encrypted: the whole point is to be readable by every
 * logged-in user without needing their main key. `created_by` is kept
 * as an audit trail; `active` toggles visibility without deleting the
 * row; `startAt` / `endAt` carry optional scheduling windows.
 */
export const announcements = pgTable(
  'announcements',
  {
    id: text('id').primaryKey(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    active: boolean('active').notNull().default(true),
    startAt: timestamp('start_at', { withTimezone: true }),
    endAt: timestamp('end_at', { withTimezone: true }),
    createdBy: text('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('announcements_active_idx').on(t.active, t.createdAt)],
);

/**
 * Factory for per-module entry tables. Every module stores its records
 * with the same shape: an opaque encrypted payload + a HMAC guard
 * computed by the client from its main key + the record id.
 *
 * Using a single factory guarantees structural uniformity across
 * collections — middleware can treat any entry table interchangeably.
 */
function createEntryTable(name: string) {
  return pgTable(
    name,
    {
      id: text('id').primaryKey(),
      userId: text('user_id')
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
      /**
       * `module_user_id` is an anonymous per-module sub-identifier chosen
       * by the client. Two modules can never collide because the
       * (user_id, module_user_id) tuple scopes queries, and the sid is
       * derived from module-specific entropy client-side.
       */
      moduleUserId: text('module_user_id').notNull(),
      cipherIv: text('cipher_iv').notNull(),
      payload: text('payload').notNull(),
      /**
       * HMAC guard. `"init"` on creation (client doesn't yet know the
       * record id), then promoted once to `g_<64 hex>` and frozen.
       * Never exposed in read responses.
       */
      guard: text('guard').notNull(),
      createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
      updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    },
    (t) => [index(`${name}_user_sid_idx`).on(t.userId, t.moduleUserId)],
  );
}

export const moodEntries = createEntryTable('mood_entries');
export const goalsEntries = createEntryTable('goals_entries');
export const passageEntries = createEntryTable('passage_entries');
export const habitsItemsEntries = createEntryTable('habits_items_entries');
export const habitsLogsEntries = createEntryTable('habits_logs_entries');
export const libraryItemsEntries = createEntryTable('library_items_entries');
export const libraryReviewsEntries = createEntryTable('library_reviews_entries');
export const libraryCoversEntries = createEntryTable('library_covers_entries');
export const reviewEntries = createEntryTable('review_entries');

/**
 * Shared type alias. All entry tables are structurally identical and can
 * be used interchangeably in generic helpers (middleware, factories).
 */
export type EntryTable = typeof moodEntries;

/**
 * Per-user module configuration (which modules are active, per-module
 * settings). Keyed on user_id (1:1) so `requireUser` is sufficient — no
 * guard validation. This is documented here and in the route handler.
 */
export const modulesConfig = pgTable('modules_config', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cipherIv: text('cipher_iv').notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * User preferences — theme, language, and any other cross-device
 * personalisation. 1:1 on `user_id`, same E2E-encrypted envelope as
 * `modules_config` (no `guard` needed; the user IS the record). Kept
 * as a separate table so server-side admins can never accidentally
 * read preferences while auditing modules, and vice versa.
 */
export const userPreferences = pgTable('user_preferences', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  cipherIv: text('cipher_iv').notNull(),
  payload: text('payload').notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Session = typeof sessions.$inferSelect;
export type NewSession = typeof sessions.$inferInsert;
export type Invite = typeof invites.$inferSelect;
export type AppSetting = typeof appSettings.$inferSelect;
export type NewAppSetting = typeof appSettings.$inferInsert;
export type NewInvite = typeof invites.$inferInsert;
export type EntryRow = typeof moodEntries.$inferSelect;
export type NewEntryRow = typeof moodEntries.$inferInsert;
export type ModulesConfig = typeof modulesConfig.$inferSelect;
export type UserPreferences = typeof userPreferences.$inferSelect;
export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;
export type Announcement = typeof announcements.$inferSelect;
export type NewAnnouncement = typeof announcements.$inferInsert;

// --- Auth v2 types -----------------------------------------------------------
export type OpaqueRecord = typeof opaqueRecords.$inferSelect;
export type NewOpaqueRecord = typeof opaqueRecords.$inferInsert;
export type AuthFactor = typeof authFactors.$inferSelect;
export type NewAuthFactor = typeof authFactors.$inferInsert;
export type MfaTotp = typeof mfaTotp.$inferSelect;
export type NewMfaTotp = typeof mfaTotp.$inferInsert;
export type MfaTotpRecoveryCode = typeof mfaTotpRecoveryCodes.$inferSelect;
export type NewMfaTotpRecoveryCode = typeof mfaTotpRecoveryCodes.$inferInsert;
export type MfaBypassRequest = typeof mfaBypassRequests.$inferSelect;
export type NewMfaBypassRequest = typeof mfaBypassRequests.$inferInsert;
export type EmailVerification = typeof emailVerifications.$inferSelect;
export type NewEmailVerification = typeof emailVerifications.$inferInsert;
