import { z } from 'zod';

/**
 * Multi-step register flow (Auth-Spec.md §7.1, Auth-Roadmap Phase 1B).
 *
 * Replaces the single-shot legacy `POST /auth/register` for new accounts.
 * The legacy route stays operational during the migration window —
 * existing flows that consume it (admin-created users, possibly migrated
 * frontend before 1C ships) keep working unchanged.
 *
 * The new flow is two endpoints in 1B:
 *   1. `POST /auth/register/start` (this file's `RegisterStartBody`)
 *   2. `POST /auth/register/verify-email` (this file's `VerifyEmailBody`)
 *   3. `GET /auth/register/state` (the resume helper, no body)
 *
 * Steps 3–7 of the Auth-Spec multi-step flow (set-password,
 * save-recovery-code, optional-totp, optional-passkey, finish) ship in
 * Phases 2+ of Auth-Roadmap once OPAQUE is wired.
 */

/**
 * Step 1 — `POST /auth/register/start`
 *
 * Anonymous (no cookie). Creates a `pre_register` users row, stores a
 * hashed 6-digit code in email_verifications, and emails it to the
 * recipient. Always responds 200 regardless of email/invite validity
 * (anti-enumeration).
 */
export const RegisterStartBodySchema = z.object({
  email: z.string().email().max(254),
  inviteCode: z.string().min(1).max(128),
});
export type RegisterStartBody = z.infer<typeof RegisterStartBodySchema>;

/**
 * Step 2 — `POST /auth/register/verify-email`
 *
 * Anonymous in body but state-bearing: the email serves to look up the
 * pending verification (since the user has no cookie yet at this step).
 * On success, the server emits a `register` session cookie and the
 * client moves to step 3. On failure, returns 401 with structured
 * `reason` so the UI can show a precise message.
 */
export const VerifyEmailBodySchema = z.object({
  email: z.string().email().max(254),
  code: z.string().regex(/^\d{6}$/, 'invalid_code_format'),
});
export type VerifyEmailBody = z.infer<typeof VerifyEmailBodySchema>;

/**
 * Step 3+ resume helper — `GET /auth/register/state`
 *
 * Reads the register cookie, returns the current register_state and
 * minimal metadata so the client knows which step to render. Only
 * accessible with a valid `register` session cookie.
 */
export const RegisterStateResponseSchema = z.object({
  userId: z.string(),
  email: z.string().email(),
  registerState: z.enum([
    'pre_register',
    'email_verified',
    'password_set',
    'recovery_set',
    'complete',
  ]),
});
export type RegisterStateResponse = z.infer<typeof RegisterStateResponseSchema>;

/**
 * Standardised error reasons for the verify-email route. The client
 * uses these to localise UI messages without parsing free-text.
 */
export const VerifyEmailErrorReason = z.enum([
  'invalid_body',
  'no_pending_verification',
  'expired',
  'too_many_attempts',
  'invalid_code',
]);
export type VerifyEmailErrorReason = z.infer<typeof VerifyEmailErrorReason>;

const Base64ish = z.string().min(1);

/**
 * Step 3 — `POST /auth/register/set-password` (Auth-Roadmap Phase 1C
 * bridge — replaced by OPAQUE in Phase 2).
 *
 * Requires the register cookie. Hooks the legacy crypto envelope onto
 * the multi-step flow: the user supplies a password (client derives
 * KEK + wraps a fresh main key) and the original invite code (kept in
 * frontend state since step 1). Server validates everything, consumes
 * the invite, completes the user (registerState = 'complete'), revokes
 * the register session and emits a full session.
 *
 * In Phase 2 this route is replaced by the OPAQUE-based step 3 flow
 * (cf. Auth-Spec §7.1.3) which derives the wrapping key from
 * `export_key` instead of the raw password.
 */
export const RegisterSetPasswordBodySchema = z.object({
  password: z.string().min(12).max(200),
  inviteCode: z.string().min(1).max(128),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type RegisterSetPasswordBody = z.infer<typeof RegisterSetPasswordBodySchema>;
