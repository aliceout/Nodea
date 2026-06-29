import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import { registerState, securityMode, sessionKind } from './enums.ts';

/**
 * Users — owners of encrypted data.
 *
 * Auth model : OPAQUE + multi-factor (Auth-Spec.md §4). Each
 * row carries `wrapped_main_key`, `wrapped_kek_password`,
 * `wrapped_kek_recovery`, `recovery_code_hash`, plus the
 * `security_mode` and `register_state` enums. The KEK is a
 * random 32-byte secret wrapped multiple times (one wrap per
 * factor), and the OPAQUE record itself lives in the
 * `opaque_records` table.
 *
 * The wrap blobs are nullable so that a freshly-pre-registered
 * user (`register_state = 'pre_register'` after Phase 1 step
 * 1) can sit in the table without credentials yet — Phase 1
 * step 2 sets them atomically with the OPAQUE record. After
 * registration completes, `register_state = 'complete'` and
 * every wrap blob is populated.
 *
 * Phase 2D dropped the pre-OPAQUE columns (`password_hash`,
 * `encryption_salt`, `encrypted_key`) — see migration 0011.
 */
export const users = pgTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    /**
     * Public display name. Optional — users can register
     * without setting one. Uniqueness is enforced via a
     * partial unique index so multiple rows with NULL stay
     * allowed.
     */
    username: text('username'),

    /** Email verification timestamp. NULL until step 2 of
     *  register. */
    emailVerifiedAt: timestamp('email_verified_at', { withTimezone: true }),

    /** Cooldown anchor for change-email (7 days). NULL until
     *  first change-email or destructive reset (Auth-Spec
     *  §13). */
    emailChangedAt: timestamp('email_changed_at', { withTimezone: true }),

    /** Per-user security policy — see `securityMode` enum
     *  docs. */
    securityMode: securityMode('security_mode').notNull().default('password_or_passkey'),

    /** Multi-step register state machine — see `registerState`
     *  enum docs. The Phase 1 register flow explicitly
     *  INSERTs `'pre_register'` at step 1 and transitions to
     *  `'complete'` at step 2. The schema default is
     *  `'complete'` for the few out-of-band insertion paths
     *  (admin seed, fixtures) where the user is fully
     *  provisioned in a single statement. */
    registerState: registerState('register_state').notNull().default('complete'),

    /** AES-GCM ciphertext of the main key under the KEK. Set
     *  ONCE at register (or migration) and never re-wrapped.
     *  AAD = users.id. */
    wrappedMainKey: text('wrapped_main_key'),
    wrappedMainKeyIv: text('wrapped_main_key_iv'),

    /** AES-GCM ciphertext of the KEK under wk_password (HKDF
     *  of OPAQUE export_key). Re-wrapped on change-password.
     *  AAD = buildAAD([users.id, "password"]). */
    wrappedKekPassword: text('wrapped_kek_password'),
    wrappedKekPasswordIv: text('wrapped_kek_password_iv'),

    /** AES-GCM ciphertext of the KEK under wk_recovery (HKDF
     *  of BIP39 recovery code entropy). Re-wrapped on
     *  recovery code regeneration or recover-kek flow. AAD =
     *  buildAAD([users.id, "recovery"]). */
    wrappedKekRecovery: text('wrapped_kek_recovery'),
    wrappedKekRecoveryIv: text('wrapped_kek_recovery_iv'),

    /** SHA-256 hex of `recovery_bytes` (16-byte BIP39
     *  entropy). Authorises the recover-kek flow without
     *  storing the code itself (128-bit entropy →
     *  uncrackable offline). Cf. Auth-Spec §7.7. */
    recoveryCodeHash: text('recovery_code_hash'),

    /** Set when the user explicitly acknowledges they've
     *  noted the recovery code at register step 4. Hard
     *  gate — without this we refuse to advance to
     *  register_state = 'recovery_set'. */
    recoveryAcknowledgedAt: timestamp('recovery_acknowledged_at', {
      withTimezone: true,
    }),

    /** Anchor for the periodic re-verify backoff (Auth-Roadmap
     *  Phase 3B). Stamped `now()` every time the user proves they
     *  still hold the current recovery phrase — at signup
     *  acknowledgement, on (re)generation, and on each successful
     *  `POST /auth/security/recovery-code-verify`. NULL only for
     *  users with no code (recover-kek consumed it, or never set).
     *  Combined with `recovery_verify_streak`, drives
     *  `recoveryReverifyDue` on `/auth/me`. Backfilled to
     *  `recovery_acknowledged_at` for pre-Phase-3B rows. */
    recoveryVerifiedAt: timestamp('recovery_verified_at', {
      withTimezone: true,
    }),

    /** Consecutive successful re-verifications of the CURRENT phrase.
     *  Lengthens the backoff window (6 wk → 3 mo → 6 mo → 1 yr) as
     *  trust builds. Reset to 0 whenever the phrase changes
     *  (regenerate / recover-kek consume) so a new phrase starts the
     *  ladder over. NOT NULL, defaults 0. */
    recoveryVerifyStreak: integer('recovery_verify_streak').notNull().default(0),

    // --- Existing onboarding fields (preserved as-is) -----
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
 * Sessions — server-side session records. The cookie carries
 * only the signed session id ; rights and TTL live here so
 * that logout / revocation is immediate.
 *
 * Auth v2 extensions (cf. Auth-Spec.md §5.2) : `kind`
 * distinguishes full / mfa_pending / register / migrate
 * sessions, each scoped by `loadSession` middleware to its
 * allowed routes via cookie name. `reauth_*_at` track the
 * matrice de re-auth (Auth-Spec §6) for privileged
 * operations. `mfa_*_verified` flags accumulate during
 * stepped MFA in `mfa_pending` sessions until promotion to
 * `full`. `pending_webauthn_challenge` carries the
 * per-session challenge across `/auth/passkeys/{enroll,login}/start`
 * → `/finish` without needing Redis (V1 single-instance
 * assumption).
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

    // --- Re-auth fresh tracking (5 min window per
    //     Auth-Spec §5.3) ---
    reauthPasswordAt: timestamp('reauth_password_at', { withTimezone: true }),
    reauthPasskeyAt: timestamp('reauth_passkey_at', { withTimezone: true }),

    // --- Stepped MFA accumulators (mfa_pending kind only,
    //     §7.4) ---
    mfaPasswordVerified: boolean('mfa_password_verified').notNull().default(false),
    mfaPasskeyVerified: boolean('mfa_passkey_verified').notNull().default(false),
    mfaTotpVerified: boolean('mfa_totp_verified').notNull().default(false),

    // --- WebAuthn challenge persisted on session
    //     (TTL 5 min, §9.2) ---
    pendingWebauthnChallenge: text('pending_webauthn_challenge'),
    pendingWebauthnChallengeAt: timestamp('pending_webauthn_challenge_at', {
      withTimezone: true,
    }),

    // --- Audit metadata (deprecated, never written to since
    //     auth-v2 ; kept nullable for back-compat until the next
    //     destructive cleanup migration. The active-sessions UI
    //     uses `deviceLabelCipher` below instead — privacy-first,
    //     never the raw user-agent header). ---
    ipHash: text('ip_hash'),
    userAgent: text('user_agent'),

    // --- Device hint for the active-sessions UI ---
    // Encrypted label the client computes from `navigator.userAgent`
    // (« MacBook », « iPhone », etc.) — AES-GCM, AAD-bound to
    // `users.id + "session-device-label"`. The server never sees
    // the cleartext, never captures the raw user-agent header.
    // Issue #47.
    //
    // Both columns null when the client hasn't yet PATCHed a label
    // (legacy sessions, or first GET before the post-login PATCH
    // lands). The UI shows a generic « Appareil inconnu » fallback
    // in that case.
    deviceLabelCipher: text('device_label_cipher'),
    deviceLabelIv: text('device_label_iv'),

    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }),

    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('sessions_expires_at_idx').on(t.expiresAt),
    index('sessions_user_kind_idx').on(t.userId, t.kind),
  ],
);
