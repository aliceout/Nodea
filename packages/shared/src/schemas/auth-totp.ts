/**
 * Zod DTOs for TOTP enrollment + management (enroll start/verify, disable,
 * backup-code regenerate).
 *
 * Where: packages/shared — shared by the api `/auth/totp/*` routes and the
 * web TOTP settings flow.
 */
import { z } from 'zod';

/**
 * TOTP schemas (Auth-Roadmap Phase 5, Auth-Spec §8).
 *
 * Three surfaces:
 *
 *   1. **Settings — enrollment** (authenticated user, password proof
 *      required per §6 matrix):
 *      - `POST /auth/totp/enroll/start` → returns base32 secret +
 *        otpauth URI + 10 backup codes (shown once).
 *      - `POST /auth/totp/enroll/verify` → user types a TOTP code
 *        AND acknowledges the backup codes; server flips
 *        `mfa_totp.enabled_at = now()`.
 *
 *   2. **Settings — manage** (authenticated, fresh password):
 *      - `POST /auth/totp/disable` → wipes secret + backup codes
 *        (and downgrades security_mode if needed, §6.1).
 *      - `POST /auth/totp/backup-codes/regenerate` → fresh batch.
 *
 *   3. **Login stepped MFA** (Phase 5C, on a `mfa_pending` session):
 *      - `POST /auth/mfa/totp/verify` → consumes a TOTP code OR
 *        a backup code, sets `mfa_totp_verified` on the pending row.
 *
 * Backup codes are 24 base32 chars with optional hyphens — the
 * server normalises before hashing. The user types the code as
 * displayed (with or without hyphens, any case).
 */

const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);
const TotpCode = z.string().regex(/^\d{6}$/);
const BackupCodeInput = z.string().min(24).max(64);

/* ============================================================================
 * Enrollment (authenticated, password proof required)
 * ========================================================================== */

/**
 * `POST /auth/totp/enroll/start` — body. Empty in V2 (Phase 7B):
 * the server gates re-auth via `requireFreshPassword` middleware
 * rather than an embedded OPAQUE proof. The route exists at all
 * because /verify needs the secret persisted server-side first.
 */
export const TotpEnrollStartBodySchema = z.looseObject({});
export type TotpEnrollStartBody = z.infer<typeof TotpEnrollStartBodySchema>;

/**
 * `POST /auth/totp/enroll/start` — response. The base32 secret is
 * displayed for users who can't scan a QR (manual entry); the
 * `otpauthUri` carries the same secret + the spec params and is
 * what the QR encoder serialises. `backupCodes` are shown once and
 * must be acknowledged at /verify.
 */
export const TotpEnrollStartResponseSchema = z.object({
  secretBase32: z.string().min(16),
  otpauthUri: z.string().startsWith('otpauth://totp/'),
  backupCodes: z.array(z.string().min(24).max(64)).length(10),
});
export type TotpEnrollStartResponse = z.infer<
  typeof TotpEnrollStartResponseSchema
>;

/**
 * `POST /auth/totp/enroll/verify` — body. Confirms the user pulled
 * the secret into their authenticator app + acknowledges the backup
 * codes. Server refuses to flip `enabled_at` if the ack is missing
 * (Auth-Spec §8.2).
 */
export const TotpEnrollVerifyBodySchema = z.object({
  code: TotpCode,
  backupCodesAcknowledged: z.literal(true),
});
export type TotpEnrollVerifyBody = z.infer<typeof TotpEnrollVerifyBodySchema>;

/* ============================================================================
 * Disable + regenerate backup codes (authenticated, password proof)
 * ========================================================================== */

/**
 * Shared body shape — Phase 7B. The OPAQUE password proof has
 * moved to the `requireFreshPassword` middleware on every Settings
 * route, so the body is empty. Kept as an explicit schema (rather
 * than inlined `z.object({})`) for symmetry with the other Settings
 * routes and because callers still type-check against this name.
 */
export const TotpManagementBodySchema = z.looseObject({});
export type TotpManagementBody = z.infer<typeof TotpManagementBodySchema>;

export const TotpRegenerateBackupCodesResponseSchema = z.object({
  backupCodes: z.array(z.string().min(24).max(64)).length(10),
});
export type TotpRegenerateBackupCodesResponse = z.infer<
  typeof TotpRegenerateBackupCodesResponseSchema
>;

/* ============================================================================
 * MFA verify during stepped login (anonymous on the mfa_pending session)
 * ========================================================================== */

/**
 * `POST /auth/mfa/totp/verify` — body. The session cookie carries
 * the `mfa_pending` row id; we accept either a TOTP code or a
 * backup code in the same field — the route disambiguates by
 * length / format.
 *
 * Sha256Hex is exposed here so the client can pre-hash a backup
 * code for diagnostic purposes, but the standard flow sends the
 * raw code and lets the server hash it before comparison. Most
 * callers will use `TotpMfaVerifyCodeBodySchema`.
 */
export const TotpMfaVerifyCodeBodySchema = z.object({
  /** TOTP digits (`/^\d{6}$/`) OR backup code as displayed
   *  (24-char base32, hyphens optional). */
  code: z.union([TotpCode, BackupCodeInput]),
});
export type TotpMfaVerifyCodeBody = z.infer<typeof TotpMfaVerifyCodeBodySchema>;

// Re-exported for callers that want to type the same shape from
// the recovery-code module (which uses the same primitive).
export { Sha256Hex as TotpSha256Hex };
