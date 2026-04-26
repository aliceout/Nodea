import { z } from 'zod';

/**
 * Single-step register flow with post-submit magic-link activation.
 *
 * Replaces the 3-step wizard from Phase 1B/1C — friction was too high
 * for non-technical users. The new flow:
 *
 *   1. `POST /auth/register` — user submits email + password +
 *      invite (if open registration is disabled). Server creates the
 *      account in `email_verified_at = NULL` state, generates a magic
 *      link token, sends an activation email. Always responds 200
 *      (anti-enumeration).
 *
 *   2. User clicks the link in their email →
 *      `POST /auth/register/activate { token }` — server validates,
 *      flips `email_verified_at = now()`, and the account becomes
 *      loginable. The login route refuses accounts where
 *      `email_verified_at IS NULL`.
 *
 * Phase 2 of Auth-Roadmap (OPAQUE) extends this with the additional
 * crypto enrollment steps (recovery code, optional TOTP/passkey).
 */

const Base64ish = z.string().min(1);

/**
 * `POST /auth/register` — submit step.
 *
 * Anonymous. The body carries everything needed to provision a
 * complete-but-unactivated account: email, password (Argon2id-hashed
 * server-side), invite code, and the encryption envelope produced by
 * the client (`encryptionSalt` + `encryptedKey`). The legacy single-shot
 * `RegisterBody` from `auth.ts` is the sibling of this schema for
 * admin paths that bypass activation entirely.
 */
export const RegisterSubmitBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
  inviteCode: z.string().min(1).max(128),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type RegisterSubmitBody = z.infer<typeof RegisterSubmitBodySchema>;

/**
 * `POST /auth/register/activate` — magic-link click target.
 *
 * The frontend extracts `?token=…` from the URL and posts it to this
 * route. Server validates (single-use, expiry, hash match), sets
 * `email_verified_at = now()` on the matching user, and returns the
 * user's email so the UI can show a friendly success message.
 */
export const RegisterActivateBodySchema = z.object({
  token: z.string().min(16).max(256),
});
export type RegisterActivateBody = z.infer<typeof RegisterActivateBodySchema>;

/**
 * Standardised reasons for activation failures, so the UI can localise
 * messages without parsing free-text.
 */
export const RegisterActivateErrorReason = z.enum([
  'invalid_token',
  'expired',
  'already_consumed',
]);
export type RegisterActivateErrorReason = z.infer<
  typeof RegisterActivateErrorReason
>;
