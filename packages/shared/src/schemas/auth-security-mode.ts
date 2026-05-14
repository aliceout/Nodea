import { z } from 'zod';

/**
 * Security-mode change schema (Auth-Roadmap Phase 5D, Auth-Spec §6.1).
 *
 * `POST /auth/security-mode/change` lets the user pick between:
 *
 *   - `password_or_passkey` — default. Either factor unlocks the
 *     session in one step.
 *   - `always_2fa` — a 2nd factor (TOTP OR passkey, user's choice
 *     at login since #72) is required after password.
 *   - `maximum` — password + passkey + TOTP, all three.
 *
 * Activation gate (§6.1):
 *
 *   - `always_2fa` requires at least one 2nd factor available:
 *     `mfa_totp.enabled_at IS NOT NULL` OR ≥ 1 row in
 *     `auth_factors` with `kind = 'passkey'`.
 *   - `maximum` requires `mfa_totp.enabled_at IS NOT NULL` AND
 *     at least one PRF-capable passkey
 *     (`auth_factors.prf_supported = true`).
 *
 * Server-side validation refuses with:
 *   - `400 second_factor_required` (always_2fa, no factor enrolled),
 *   - `400 totp_required` (maximum, no TOTP),
 *   - `400 passkey_required` (maximum, no PRF passkey).
 *
 * The matrice de re-auth (§6) requires a fresh password proof —
 * gated server-side by `requireFreshPassword` (Phase 7B), so the
 * body carries only the new mode.
 */
export const SecurityModeSchema = z.enum([
  'password_or_passkey',
  'always_2fa',
  'maximum',
]);
export type SecurityMode = z.infer<typeof SecurityModeSchema>;

export const SecurityModeChangeBodySchema = z.object({
  mode: SecurityModeSchema,
});
export type SecurityModeChangeBody = z.infer<
  typeof SecurityModeChangeBodySchema
>;
