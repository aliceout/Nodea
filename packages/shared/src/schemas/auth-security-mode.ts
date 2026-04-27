import { z } from 'zod';

/**
 * Security-mode change schema (Auth-Roadmap Phase 5D, Auth-Spec §6.1).
 *
 * `POST /auth/security-mode/change` lets the user pick between:
 *
 *   - `password_or_passkey` — default. Either factor unlocks the
 *     session in one step.
 *   - `always_totp` — TOTP required after password OR passkey.
 *   - `maximum` — password + passkey + TOTP, all three.
 *
 * Activation gate (§6.1):
 *
 *   - `always_totp` requires `mfa_totp.enabled_at IS NOT NULL`.
 *   - `maximum` requires the above AND at least one PRF-capable
 *     passkey (`auth_factors.prf_supported = true`).
 *
 * Server-side validation refuses with `400 totp_required` /
 * `400 passkey_required` when the prerequisites aren't met. The
 * matrice de re-auth (§6) requires a fresh password proof —
 * standard `OpaquePasswordProof` body shape inlined here.
 */
export const SecurityModeSchema = z.enum([
  'password_or_passkey',
  'always_totp',
  'maximum',
]);
export type SecurityMode = z.infer<typeof SecurityModeSchema>;

export const SecurityModeChangeBodySchema = z.object({
  mode: SecurityModeSchema,
  proofLoginToken: z.string().min(1).max(2048),
  proofFinishLoginRequest: z.string().min(1).max(8192),
});
export type SecurityModeChangeBody = z.infer<
  typeof SecurityModeChangeBodySchema
>;
