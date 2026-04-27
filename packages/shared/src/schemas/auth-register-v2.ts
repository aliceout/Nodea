import { z } from 'zod';
import { UsernameField } from './auth.ts';

/**
 * Single-step register flow — two paths, same form:
 *
 *   - **Invited path** (Bitwarden-style): admin issues an invite for
 *     a specific email; recipient clicks the link in the email,
 *     lands on `/register?invite=<token>`, fills password, submits.
 *     The email click proves email control → account is created
 *     **already activated**. No second email is sent.
 *
 *   - **Open registration** (toggle in admin settings): when
 *     `open_registration = true`, anyone can register without an
 *     invite. The account is created inactive and the user receives
 *     a separate activation email with a magic link.
 *
 *   - **Closed**: when `open_registration = false` and no invite
 *     token is supplied, the route returns 403 `registration_closed`.
 *     The frontend reads `GET /auth/register/mode` on mount to know
 *     which form to show.
 *
 * The legacy /auth/register/start + verify-email + state +
 * set-password endpoints from Phase 1B/1C are gone — replaced by
 * this single submit + the magic-link activation route below.
 */

const Base64ish = z.string().min(1);

/**
 * `POST /auth/register` — submit step.
 *
 * Anonymous. Carries the full account provisioning payload (email,
 * password, encryption envelope) plus an optional invite token. The
 * server's branching logic:
 *
 *   - `inviteToken` present → strict email match against the invite,
 *     consume + create activated account.
 *   - No token + open_registration ON → create inactive account, send
 *     activation email.
 *   - No token + open_registration OFF → 403.
 */
export const RegisterSubmitBodySchema = z.object({
  email: z.string().email().max(254),
  /** Public display name — required at register. Same shape rules as
   *  `ChangeUsernameBody.username` (UsernameField, 2–32 chars). The
   *  user is told this can be a first name or a pseudo. Uniqueness is
   *  enforced at the DB layer via the partial unique index. */
  username: UsernameField,
  password: z.string().min(12).max(200),
  /** Clear token from `?invite=<token>` in the invite link URL.
   *  Optional: omitted when registering via the open-registration
   *  toggle path. */
  inviteToken: z.string().min(16).max(256).optional(),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type RegisterSubmitBody = z.infer<typeof RegisterSubmitBodySchema>;

/**
 * Response shape for `GET /auth/register/mode`. The frontend reads
 * this on mount to decide which form to show.
 */
export const RegisterModeResponseSchema = z.object({
  /** True when admin has flipped open_registration on. False
   *  otherwise; the user must arrive via an invite link. */
  openRegistration: z.boolean(),
});
export type RegisterModeResponse = z.infer<typeof RegisterModeResponseSchema>;

/**
 * Response shape for `GET /auth/register/invite-info?token=…`.
 * Returned for valid + non-consumed + non-expired tokens; the
 * route 404s otherwise so the frontend can show an "expired link"
 * page.
 */
export const InviteInfoResponseSchema = z.object({
  email: z.string().email(),
  expiresAt: z.string().datetime().nullable(),
});
export type InviteInfoResponse = z.infer<typeof InviteInfoResponseSchema>;

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
