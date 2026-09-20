/**
 * Auth / MFA tables (Drizzle DDL, split by domain, re-exported by
 * `db/schema.ts`). Holds: `opaque_records`, `auth_factors`, `mfa_totp`,
 * `mfa_totp_recovery_codes`, `mfa_bypass_requests`, `email_verifications`,
 * `password_reset_tokens`.
 *
 * Where: api db layer. Every table FK-references `users` with ON DELETE
 * CASCADE. Per-table specifics (PKs, AAD-bound blobs, the partial unique
 * index on active bypass requests) are documented on each export below.
 */
import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core';

import {
  authFactorKind,
  emailVerificationKind,
  mfaFactor,
} from './enums.ts';
import { users } from './users.ts';

/**
 * OPAQUE registration records — 1:1 with users.
 *
 * Each row is the OPAQUE envelope produced at register (or
 * migration). The PK is `user_id` so we can swap envelopes
 * atomically on change-password / change-email / recover-kek
 * without losing the 1:1 invariant.
 *
 * `user_identifier` is the identifier the envelope was registered
 * under (the lowercased email at registration / last re-register).
 * OPAQUE requires the SAME identifier at `startLogin` as at
 * `createRegistrationResponse` — before this column existed, login
 * derived it from `users.email`, so changing the account email
 * permanently locked the account out (audit 2026-06). NULL on
 * legacy rows means « identifier = current users.email » (correct
 * for every account that never changed email — the only kind that
 * could log in before this fix).
 *
 * `server_key_version` lets us track which version of the
 * server static key signed each envelope. V1 ships with
 * version 1 only ; issue #39 covers the rotation mechanism
 * (multiple versions stored in a future `opaque_server_keys`
 * table, lazy re-register at login).
 */
export const opaqueRecords = pgTable('opaque_records', {
  userId: text('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  envelope: text('envelope').notNull(),
  userIdentifier: text('user_identifier'),
  serverKeyVersion: integer('server_key_version').notNull().default(1),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

/**
 * Auth factors — currently passkeys (WebAuthn).
 *
 * `wrapped_kek` (+ iv) holds the AES-GCM ciphertext of the
 * KEK under wk_passkey (HKDF of the PRF output). NULL when
 * `prf_supported = false` (login-only credential, can
 * authenticate but cannot unwrap data — the user must
 * combine with password). AAD = buildAAD([users.id,
 * "passkey", credential_id]).
 *
 * `sign_count_strict` is true at enrollment and gets flipped
 * to false (per-credential, never back to true) after 3
 * consecutive assertions where the authenticator returned
 * `signCount = 0` — Apple authenticators do this and we must
 * not reject them. Cf. Auth-Spec §9.6.
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
 * `secret` is stored in clear (RFC 6238 requires the server
 * to verify codes ; cf. Auth-Spec §2.3 trade-off).
 * `last_window` is the anti-replay cursor (refuse any window
 * <= stored). `enabled_at = NULL` means enrollment is in
 * progress and login does not count this user as having TOTP.
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
 * (SHA-256) since each carries 130 bits of entropy.
 * Single-use : `used_at` is set at consumption and the row
 * stays for audit.
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
 * MFA bypass requests — for users who lost TOTP or all
 * passkeys.
 *
 * Flow : 7-day delay after the user clicks the email
 * confirm link. Eligibility check (cf. Auth-Spec §7.8)
 * refuses the request when multiple required factors are
 * missing simultaneously (the « perdu 2 trucs = niqué »
 * policy). The unique partial index ensures one user can
 * never have two active requests at the same time
 * (cancelling stale ones first).
 *
 * `factor` disambiguates which side-effect fires at
 * consumption : `'totp'` → disable TOTP + purge backup
 * codes ; `'passkey'` → delete all auth_factors of
 * kind=passkey. Mode `maximum` then auto-downgrades to
 * `password_or_passkey` if applicable.
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
    // One active bypass per user, all factors combined.
    // Forces serial recovery and prevents quick chaining
    // (passkey-then-TOTP in 96h).
    uniqueIndex('mfa_bypass_one_active')
      .on(t.userId)
      .where(sql`cancelled_at IS NULL AND consumed_at IS NULL`),
  ],
);

/**
 * Email verifications — 6-digit codes for register step 2
 * and change-email step B. Codes hashed (SHA-256) with
 * `attempts` counter (max 5 before purge + force re-request)
 * and a 10-minute expiry. Cleanup cron purges
 * consumed/expired rows (cf. §13.2).
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
  (t) => [
    index('email_verifications_email_idx').on(t.email),
    // The token-validation lookup filters by (kind, code_hash) — see
    // `auth/email-verifications.ts`. Without an index on code_hash that
    // was a sequential scan on every magic-link / verification submit
    // (audit 2026-06 passe 2). The table stays small (the weekly
    // cleanup cron purges expired/consumed rows), but the index is
    // cheap insurance against a slow-validate as volume grows.
    index('email_verifications_code_hash_idx').on(t.codeHash),
  ],
);

/**
 * Password-reset tokens. Stored hashed (same pattern as
 * invites) with a short expiry. Consuming a token is atomic :
 *   - the row is looked up by `token_hash`
 *   - the transaction purges every user-owned encrypted row
 *     (see `/auth/reset` handler) because resetting the
 *     password means the user lost their main key — old
 *     ciphertexts become unreadable
 *   - the password hash + envelope are replaced with fresh
 *     values
 *   - `used_at` is set so the token can't be replayed.
 *
 * Rate limiting on the public request route protects against
 * email enumeration ; the route itself always returns 200
 * whether or not the email belongs to a user.
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
