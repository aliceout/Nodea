/**
 * Zod DTOs for stepped-MFA verification (TOTP + passkey second factor).
 *
 * Where: packages/shared — shared by the api `/auth/mfa/*` routes and the
 * web MFA flow. The TOTP `code` field accepts either a 6-digit code or a
 * backup code (format-disambiguated server-side).
 */
import { z } from 'zod';

/**
 * Stepped MFA schemas (Auth-Roadmap Phase 5C, Auth-Spec §7.4).
 *
 * When `users.security_mode != 'password_or_passkey'`, the primary
 * login route (`/auth/login/finish` or `/auth/passkeys/login/finish`)
 * emits a `mfa_pending` session instead of a `full` one and returns
 * a needsMfa-discriminated response. The client then drives the
 * stepped flow:
 *
 *   1. Primary login (password OPAQUE OR passkey) → mfa_pending +
 *      `{ needsMfa: true, factorsNeeded: [...], wrap blobs }`.
 *   2. Client unwraps KEK + main key locally using the wrap blobs
 *      and the exportKey (or PRF output) it just derived. The
 *      session can't access data routes yet (mfa_pending fails
 *      `requireUser`) but the key material is ready.
 *   3. `POST /auth/mfa/totp/verify { code }` — server verifies and
 *      sets `mfa_totp_verified=true` on the pending row. If the
 *      pending row now satisfies all factors required by the user's
 *      `security_mode`, the same call promotes the session to full
 *      (DELETE pending, INSERT full, swap cookie) and returns
 *      `{ finalized: true }`. Otherwise it returns
 *      `{ finalized: false, missing: [...] }` and the client drives
 *      the next step (Phase 5D — passkey-as-second-factor for mode
 *      `maximum`).
 *
 * Backup codes go through the same `code` field — the server
 * disambiguates by length / format (TOTP = 6 digits, backup =
 * 24 base32 chars with optional hyphens).
 */

/** Factor identifiers the server may report as still-needed. */
export const MfaFactorSchema = z.enum(['totp', 'passkey', 'password']);
export type MfaFactor = z.infer<typeof MfaFactorSchema>;

/* ============================================================================
 * Request — `POST /auth/mfa/totp/verify`
 * ========================================================================== */

const TotpCode = z.string().regex(/^\d{6}$/);
const BackupCodeInput = z.string().min(24).max(64);

export const MfaTotpVerifyBodySchema = z.object({
  /** TOTP digits OR a 24-char base32 backup code (hyphens optional). */
  code: z.union([TotpCode, BackupCodeInput]),
});
export type MfaTotpVerifyBody = z.infer<typeof MfaTotpVerifyBodySchema>;

/* ============================================================================
 * Response — `POST /auth/mfa/totp/verify`
 * ========================================================================== */

/**
 * Discriminated response. `finalized: true` means the session was
 * promoted to `full` in the same call; the cookie was swapped, the
 * client should hit `/auth/me` to load the public user shape and
 * proceed to the app shell.
 *
 * `finalized: false` means more factors are still needed (e.g. mode
 * `maximum` requires passkey-as-second-factor after TOTP); the
 * client drives the next route. The `missing` array tells the UI
 * which form to surface.
 */
export const MfaTotpVerifyResponseSchema = z.discriminatedUnion('finalized', [
  z.object({
    finalized: z.literal(true),
  }),
  z.object({
    finalized: z.literal(false),
    missing: z.array(MfaFactorSchema).min(1),
  }),
]);
export type MfaTotpVerifyResponse = z.infer<typeof MfaTotpVerifyResponseSchema>;

/* ============================================================================
 * Passkey-as-second-factor (Auth-Roadmap Phase 5D, Auth-Spec §7.4)
 * ========================================================================== */

/**
 * `POST /auth/mfa/passkey/start` — body. Empty for now: the server
 * uses the `mfa_pending` cookie to identify the user and queries
 * their enrolled passkeys to build `allowCredentials`.
 *
 * The challenge is persisted on the pending session row
 * (`pending_webauthn_challenge`, TTL 5 min) so /finish can verify
 * it without round-tripping additional client state.
 */
export const MfaPasskeyStartBodySchema = z.looseObject({});
export type MfaPasskeyStartBody = z.infer<typeof MfaPasskeyStartBodySchema>;

const WebAuthnOptionsJSON = z.record(z.string(), z.unknown());
export const MfaPasskeyStartResponseSchema = z.object({
  requestOptions: WebAuthnOptionsJSON,
});
export type MfaPasskeyStartResponse = z.infer<
  typeof MfaPasskeyStartResponseSchema
>;

const WebAuthnResponseJSON = z.record(z.string(), z.unknown());
export const MfaPasskeyFinishBodySchema = z.object({
  assertionResponse: WebAuthnResponseJSON,
});
export type MfaPasskeyFinishBody = z.infer<typeof MfaPasskeyFinishBodySchema>;

/** Same discriminated shape as TOTP verify — promotes to full when
 *  the pending row now satisfies all factors required by the user's
 *  `security_mode`, otherwise reports what's still missing. */
export const MfaPasskeyFinishResponseSchema = z.discriminatedUnion(
  'finalized',
  [
    z.object({
      finalized: z.literal(true),
    }),
    z.object({
      finalized: z.literal(false),
      missing: z.array(MfaFactorSchema).min(1),
    }),
  ],
);
export type MfaPasskeyFinishResponse = z.infer<
  typeof MfaPasskeyFinishResponseSchema
>;
