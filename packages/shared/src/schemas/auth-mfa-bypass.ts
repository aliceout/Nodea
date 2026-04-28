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
 * `GET /auth/mfa/bypass/confirm?t=<token>` — email-link confirmation
 *
 * Returns JSON for the SPA's `/auth/bypass/confirm` route which is
 * the actual email-link target. Discriminated union so the UI can
 * render a different state per outcome:
 *   - `ok` / `already_confirmed`: success panel + countdown.
 *   - `cancelled` / `consumed` / `expired` / `unknown`: error panel.
 *
 * HTTP: 200 for `ok` / `already_confirmed`, 400 for `unknown`
 * (token malformed or not in DB), 410 for `cancelled` / `consumed` /
 * `expired` so an HTTP-aware client can distinguish "valid link, just
 * stale" from "invalid token". The SPA branches on body.status either
 * way.
 * ========================================================================== */

export const MfaBypassConfirmResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    factor: z.enum(['totp', 'passkey']),
    /** When the bypass becomes applicable at next login (now + 48h). */
    earliestApplyAt: z.string(),
  }),
  z.object({
    status: z.literal('already_confirmed'),
    factor: z.enum(['totp', 'passkey']),
    /** Same value as for `ok`, computed from `confirmedAt + 48h`. */
    earliestApplyAt: z.string(),
  }),
  z.object({ status: z.literal('cancelled') }),
  z.object({ status: z.literal('consumed') }),
  z.object({ status: z.literal('expired') }),
  z.object({ status: z.literal('unknown') }),
]);
export type MfaBypassConfirmResponse = z.infer<
  typeof MfaBypassConfirmResponseSchema
>;

/* ============================================================================
 * `GET /auth/mfa/bypass/cancel?t=<token>` — email-link cancellation
 * ========================================================================== */

export const MfaBypassCancelResponseSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('ok'),
    factor: z.enum(['totp', 'passkey']),
  }),
  z.object({
    status: z.literal('already_cancelled'),
    factor: z.enum(['totp', 'passkey']),
  }),
  z.object({ status: z.literal('consumed') }),
  z.object({ status: z.literal('unknown') }),
]);
export type MfaBypassCancelResponse = z.infer<
  typeof MfaBypassCancelResponseSchema
>;
