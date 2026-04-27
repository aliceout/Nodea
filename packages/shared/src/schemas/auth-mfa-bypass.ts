import { z } from 'zod';

/**
 * MFA bypass schemas (Auth-Roadmap Phase 6, Auth-Spec §7.8 + §6.2).
 *
 * Recovery path for a user who lost a single MFA factor (TOTP OR
 * passkey) but still has the others. Two-step:
 *
 *   1. **Request** — from the `/login/mfa` blocked screen, a user
 *      clicks "j'ai perdu mon TOTP" / "j'ai perdu ma passkey".
 *      `POST /auth/mfa/bypass/request { factor }` runs the §6.2
 *      eligibility check ("perdu 2 trucs = niqué" → 409
 *      `multi_factor_loss`) and emails a confirm + cancel link
 *      (32-byte tokens, SHA-256 hashed in DB).
 *
 *   2. **Confirm via email** — `GET /auth/mfa/bypass/confirm?t=<token>`
 *      flips `confirmed_at`. The 48h "real" delay starts here, NOT
 *      at request time. Cancel via `GET /auth/mfa/bypass/cancel`
 *      from the email.
 *
 *   3. **Apply at next login** — when the OPAQUE / passkey login
 *      finishes, the server checks for a confirmed bypass past
 *      its 48h delay. If found, applies the side-effect (disable
 *      TOTP / delete all passkeys) + downgrades `security_mode`
 *      auto + flags `consumed_at`. The user finishes login without
 *      the bypassed factor.
 *
 * One bypass active per user, all factors combined (`mfa_bypass_one_active`
 * unique partial index on the table). A second request while one
 * is pending → 409 `bypass_already_active`.
 */

/* ============================================================================
 * `POST /auth/mfa/bypass/request` (mfa_pending)
 * ========================================================================== */

export const MfaBypassRequestBodySchema = z.object({
  factor: z.enum(['totp', 'passkey']),
});
export type MfaBypassRequestBody = z.infer<typeof MfaBypassRequestBodySchema>;

export const MfaBypassRequestResponseSchema = z.object({
  /** ISO timestamp at which the user can re-login without the
   *  bypassed factor IF they confirm by email. Lets the UI render
   *  a precise message ("Tu pourras te connecter sans X à partir
   *  du <date> si tu confirmes par email."). */
  earliestApplyAt: z.string(),
});
export type MfaBypassRequestResponse = z.infer<
  typeof MfaBypassRequestResponseSchema
>;

/* ============================================================================
 * `GET /auth/mfa/bypass/active` — active bypass for the current user
 * ========================================================================== */

export const MfaBypassActiveResponseSchema = z.object({
  /** `null` = no active bypass. The route itself returns the same
   *  shape with `active: null` rather than a 404 so the UI can
   *  treat absence as a normal state. */
  active: z
    .object({
      factor: z.enum(['totp', 'passkey']),
      /** When the user confirmed the email link (null if pending). */
      confirmedAt: z.string().nullable(),
      /** When the request expires entirely (TTL 7 days from request). */
      expiresAt: z.string(),
      /** When the bypass becomes applicable at next login (only set
       *  when `confirmedAt` is — `confirmedAt + 48h`). */
      earliestApplyAt: z.string().nullable(),
    })
    .nullable(),
});
export type MfaBypassActiveResponse = z.infer<
  typeof MfaBypassActiveResponseSchema
>;

/* ============================================================================
 * `POST /auth/mfa/bypass/cancel` — authenticated cancellation
 *
 * Email-link cancellation goes through `GET /auth/mfa/bypass/cancel?t=…`
 * which is tokenised; this POST is for an in-app session cancelling
 * its own active request without going through the email.
 * ========================================================================== */

export const MfaBypassCancelBodySchema = z.object({}).passthrough();
export type MfaBypassCancelBody = z.infer<typeof MfaBypassCancelBodySchema>;
