/**
 * Zod DTOs for OPAQUE registration (invite-info, start, finish, activate).
 *
 * Where: packages/shared — shared by the api `/auth/register/*` routes and
 * the web register flow. Email is invite-bound; activation gates first login.
 */
import { z } from 'zod';

/**
 * Auth-Roadmap Phase 2B replaced the single-step Argon2id register
 * with the OPAQUE 2-step handshake (`POST /auth/register/start` +
 * `POST /auth/register/finish`). The credential body shape now
 * lives in `./auth-opaque.ts` (`OpaqueRegisterStartBodySchema` +
 * `OpaqueRegisterFinishBodySchema`).
 *
 * This file keeps the GET-side schemas (mode + invite-info) and the
 * activation magic-link schemas — they're orthogonal to the
 * credential exchange and didn't change in 2B.
 */

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
  email: z.email(),
  expiresAt: z.iso.datetime().nullable(),
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
