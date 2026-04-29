import { pgEnum } from 'drizzle-orm/pg-core';

/**
 * Auth enums shared across `users`, `sessions`, and the
 * various MFA / verification tables. Drizzle requires enum
 * values to exist before they're consumed by table builders,
 * so they live in their own module that the table modules
 * import.
 */

/**
 * Per-user security policy. Drives which factors are required
 * at login.
 *
 * - `password_or_passkey` — default. Either factor unlocks.
 *   The KEK is wrappable by both, so loss of one factor
 *   doesn't lock the user out as long as the other remains.
 * - `always_totp` — TOTP is required after password OR
 *   passkey verification.
 * - `maximum` — password + passkey + TOTP, all three.
 *   Activation invariant (Auth-Spec §6.1) : TOTP must be
 *   enabled AND at least one PRF-capable passkey must be
 *   enrolled before this mode can be selected.
 *
 * Auto-downgrade rules (Auth-Spec §6.1) :
 *   - TOTP disabled or bypassed → modes `always_totp` and
 *     `maximum` fall back to `password_or_passkey`.
 *   - Last PRF-capable passkey removed or bypassed →
 *     `maximum` falls back to `password_or_passkey`.
 */
export const securityMode = pgEnum('security_mode', [
  'password_or_passkey',
  'always_totp',
  'maximum',
]);

/**
 * Multi-step register state machine. Each new user
 * transitions pre_register → email_verified → password_set
 * → recovery_set → complete. The cleanup cron purges rows
 * stuck in pre_register for more than 24h (Auth-Spec §13.2).
 */
export const registerState = pgEnum('register_state', [
  'pre_register',
  'email_verified',
  'password_set',
  'recovery_set',
  'complete',
]);

/**
 * Session classification. `loadSession` uses the cookie name
 * to pick the expected kind and refuses any mismatch
 * (Auth-Spec §5.2).
 *
 * - `full` — fully authenticated, can hit any non-auth route.
 * - `mfa_pending` — first factor verified, awaiting MFA.
 *   Scoped to `/auth/mfa/*` and `/auth/login/*` /
 *   `/auth/passkey/login/*` for stepped MFA (Auth-Spec §7.4).
 * - `register` — multi-step register in progress. Scoped to
 *   `/auth/register/*`, 24h TTL.
 * - `migrate` — vestigial. Used during the Phase 2C lazy
 *   migration from the legacy Argon2id flow to OPAQUE. The
 *   migration is complete (Phase 2D dropped the legacy
 *   columns) ; the value stays in the enum for backward
 *   compatibility with any leftover row but is no longer
 *   minted by any code path.
 */
export const sessionKind = pgEnum('session_kind', [
  'full',
  'mfa_pending',
  'register',
  'migrate',
]);

/**
 * Auth factor type. Currently `passkey` only — TOTP and
 * OPAQUE password live in their own dedicated tables since
 * their lifecycle differs (TOTP can be disabled but stays
 * enrollable ; OPAQUE is 1:1 with users).
 */
export const authFactorKind = pgEnum('auth_factor_kind', ['passkey']);

/**
 * MFA factor a bypass request applies to. Both kinds share
 * the same 7-day-after-confirmation flow (Auth-Spec §7.8) ;
 * the `factor` column disambiguates which side-effect the
 * bypass triggers at consumption.
 */
export const mfaFactor = pgEnum('mfa_factor', ['totp', 'passkey']);

/**
 * Email verification context. Same hashing/TTL/attempts
 * policy across kinds ; the `kind` column drives which
 * downstream transition fires on success (register step 2 vs
 * change-email step B).
 */
export const emailVerificationKind = pgEnum('email_verification_kind', [
  'register',
  'email_change',
]);
