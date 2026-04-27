import { z } from 'zod';

const Base64ish = z.string().min(1);
/** OPAQUE wire blobs (base64url, sometimes 4-8 KB long). Loose ceiling
 *  is just a DoS safeguard. */
const OpaqueBlob = z.string().min(1).max(8192);

/**
 * Re-auth proof from a fresh `/auth/login/start` round-trip.
 *
 * Mutating routes that used to require `currentPassword` (Argon2id-
 * verified server-side) now ship an OPAQUE proof instead: the client
 * runs a `/auth/login/start` round-trip with the typed current password,
 * derives `exportKey` locally via `client.finishLogin`, and sends the
 * `loginToken` + the resulting `finishLoginRequest`. The server runs
 * `server.finishLogin` to verify the proof; success means the user
 * knows the current password without it ever crossing the wire in
 * clear.
 *
 * The `loginToken` is consumed on validation (single-use), so each
 * mutating call pairs with its own fresh login start.
 */
export const OpaquePasswordProofSchema = z.object({
  proofLoginToken: z.string().min(1).max(2048),
  proofFinishLoginRequest: OpaqueBlob,
});
export type OpaquePasswordProof = z.infer<typeof OpaquePasswordProofSchema>;

/**
 * Registration payload.
 *
 * Legacy single-step shape — kept around for the type alias only;
 * the actual register flow runs on `auth-opaque.ts`'s 2-step body
 * (Phase 2B). This schema isn't consumed by any live route.
 */
export const RegisterBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(12).max(200),
  inviteCode: z.string().min(1).max(128),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(200),
});
export type LoginBody = z.infer<typeof LoginBodySchema>;

/**
 * Change password — OPAQUE re-registration in 2 steps (Auth-Roadmap
 * Phase 2D, Auth-Spec §7.5).
 *
 * The protocol can't fold into a single POST because OPAQUE
 * registration itself is a 2-round-trip handshake: the client needs
 * the server's `registrationResponse` (computed from the new
 * password's `registrationRequest`) before it can finish the
 * registration locally.
 *
 *   /change-password/start
 *     Body: proof of current password + new `registrationRequest`.
 *     Server: validates the proof, runs `server.createRegistration
 *     Response`, stores a single-use `changePasswordToken` keyed on
 *     the user id, returns `{ registrationResponse, changePasswordToken }`.
 *
 *   /change-password/finish
 *     Body: `changePasswordToken` + the persisted `registrationRecord`
 *     + the KEK re-wrapped under an HKDF sub-key of the new
 *     `exportKey`. Main key isn't re-wrapped — every existing
 *     ciphertext stays readable across password changes.
 *     Server: consumes the token, replaces `opaque_records.envelope`
 *     and `users.wrapped_kek_password{,_iv}`, rotates the session.
 */
export const ChangePasswordStartBodySchema = OpaquePasswordProofSchema.extend({
  registrationRequest: OpaqueBlob,
});
export type ChangePasswordStartBody = z.infer<typeof ChangePasswordStartBodySchema>;

export const ChangePasswordStartResponseSchema = z.object({
  registrationResponse: OpaqueBlob,
  changePasswordToken: z.string().min(1).max(2048),
});
export type ChangePasswordStartResponse = z.infer<
  typeof ChangePasswordStartResponseSchema
>;

export const ChangePasswordFinishBodySchema = z.object({
  changePasswordToken: z.string().min(1).max(2048),
  registrationRecord: OpaqueBlob,
  wrappedKekPassword: Base64ish,
  wrappedKekPasswordIv: Base64ish,
});
export type ChangePasswordFinishBody = z.infer<typeof ChangePasswordFinishBodySchema>;

/**
 * Change the authenticated user's email. Re-auth via the OPAQUE
 * proof — see {@link OpaquePasswordProofSchema} for the wire shape.
 *
 * The encrypted envelope doesn't change: the email isn't part of
 * any KEK derivation in V1. The OPAQUE `userIdentifier` is the
 * email though, so a future Phase 2+ "change email = re-register
 * OPAQUE" flow will need to ship a fresh `registrationRecord` here.
 * V1 keeps this minimal — the server just updates the `email` column.
 */
export const ChangeEmailBodySchema = OpaquePasswordProofSchema.extend({
  newEmail: z.string().email().max(254),
});
export type ChangeEmailBody = z.infer<typeof ChangeEmailBodySchema>;

/**
 * Shape rules for the public display name. Letters (incl. accents),
 * digits, underscores, hyphens and periods. 2–32 chars. Exported so
 * out-of-band paths (seed scripts, admin tooling) validate usernames
 * against the same contract as the HTTP API.
 */
export const UsernameField = z
  .string()
  .min(2)
  .max(32)
  .regex(/^[\p{L}\p{N}_.\-]+$/u, 'invalid_username');

/**
 * Change the authenticated user's username. Not password-gated — a
 * username is a public identifier, not a credential. Pass `null` to
 * unset.
 */
export const ChangeUsernameBodySchema = z.object({
  username: UsernameField.nullable(),
});
export type ChangeUsernameBody = z.infer<typeof ChangeUsernameBodySchema>;

/**
 * Self-delete the authenticated user. Re-auth via the OPAQUE proof
 * — same shape as change-password / change-email, see
 * {@link OpaquePasswordProofSchema}.
 */
export const DeleteSelfBodySchema = OpaquePasswordProofSchema;
export type DeleteSelfBody = z.infer<typeof DeleteSelfBodySchema>;

/**
 * Ask for a password-reset email. Anonymous route — the response is
 * always 200 whether or not the email matches a user, to avoid
 * enumeration via response shape / latency.
 */
export const RequestResetBodySchema = z.object({
  email: z.string().email().max(254),
});
export type RequestResetBody = z.infer<typeof RequestResetBodySchema>;

/**
 * Consume a reset token — OPAQUE re-registration in 2 steps
 * (Auth-Roadmap Phase 2D, OPAQUE rewire). Same shape as the change-
 * password 2-step: the client can't compute a `registrationRecord`
 * without first getting a `registrationResponse` from the server.
 *
 *   /reset/start
 *     Body: reset `token` + new `registrationRequest`.
 *     Server: validates the token (active, not expired, not used),
 *     runs `server.createRegistrationResponse` with userIdentifier=
 *     user.email, stores a single-use `resetToken` keyed on the
 *     user id, returns `{ registrationResponse, resetToken }`.
 *
 *   /reset/finish
 *     Body: `resetToken` + the persisted `registrationRecord` +
 *     a fresh `wrappedMainKey` (the OLD main key is unrecoverable
 *     so we generate a new one) + the new KEK wrap.
 *     Server: consumes the token, purges every user-owned
 *     encrypted row, replaces every credential blob, marks the
 *     reset token used.
 *
 * No `currentPassword` proof: the reset link in the email IS the
 * auth proof. No `newPassword` over the wire either — OPAQUE keeps
 * the password client-side.
 *
 * `RequestResetBodySchema` (above) and the kept `token` field stay
 * the same; only the credential payload moved from legacy
 * `encryptionSalt`/`encryptedKey` to the OPAQUE blobs.
 */
export const ResetPasswordStartBodySchema = z.object({
  token: z.string().min(16).max(256),
  registrationRequest: OpaqueBlob,
});
export type ResetPasswordStartBody = z.infer<typeof ResetPasswordStartBodySchema>;

export const ResetPasswordStartResponseSchema = z.object({
  registrationResponse: OpaqueBlob,
  resetToken: z.string().min(1).max(2048),
  /** The user's stable id, returned so the client can compute the
   *  AAD bindings for the new wrap blobs. */
  userId: z.string().uuid(),
});
export type ResetPasswordStartResponse = z.infer<
  typeof ResetPasswordStartResponseSchema
>;

export const ResetPasswordFinishBodySchema = z.object({
  resetToken: z.string().min(1).max(2048),
  registrationRecord: OpaqueBlob,
  wrappedMainKey: Base64ish,
  wrappedMainKeyIv: Base64ish,
  wrappedKekPassword: Base64ish,
  wrappedKekPasswordIv: Base64ish,
});
export type ResetPasswordFinishBody = z.infer<typeof ResetPasswordFinishBodySchema>;

/** @deprecated kept for the type, route was split into start/finish. */
export const ResetPasswordBodySchema = ResetPasswordFinishBodySchema;
export type ResetPasswordBody = z.infer<typeof ResetPasswordBodySchema>;

/**
 * Admin-only payload to send an invite by email (Bitwarden-style).
 * Replaces the old "mint a clear code" flow — the server generates
 * a token, hashes it, and emails the recipient a link instead of
 * surfacing the code in the admin UI.
 */
export const CreateInviteBodySchema = z.object({
  email: z.string().email().max(254),
  expiresAt: z.string().datetime().optional(),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBodySchema>;

/**
 * Response bodies — what the client can rely on without decrypting.
 *
 * OPAQUE-only since Phase 2D dropped the legacy Argon2id columns.
 * The 2-layer wrap is:
 *   - main key under a random KEK → `wrappedMainKey` /
 *     `wrappedMainKeyIv` (set ONCE at register, never re-wrapped).
 *   - KEK under an HKDF sub-key of OPAQUE's `exportKey` →
 *     `wrappedKekPassword` / `wrappedKekPasswordIv` (re-wrapped at
 *     change-password and reset).
 *
 * The fields are still nullable because the user row is created
 * during register-finish and these blobs come with it — but during
 * brief windows (e.g. tests inserting a row by hand) they could be
 * absent. The client treats null as "this account is broken /
 * unrecoverable" and surfaces a key-missing prompt.
 */
export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  onboardingStatus: z.enum(['pending', 'complete']),
  onboardingVersion: z.string(),
  wrappedMainKey: Base64ish.nullable(),
  wrappedMainKeyIv: Base64ish.nullable(),
  wrappedKekPassword: Base64ish.nullable(),
  wrappedKekPasswordIv: Base64ish.nullable(),
  /** True when the user has set up a recovery code (Auth-Roadmap
   *  Phase 3). The actual `users.recovery_code_hash` value never
   *  leaves the server; we just flag presence so the UI can show
   *  the "set me up" warning vs the "regenerate" button. */
  recoveryCodeSet: z.boolean(),
  /** Total number of passkeys enrolled (`auth_factors WHERE
   *  kind='passkey'`). Drives the sidebar "configure a passkey" tip
   *  (visible at 0) and the Settings UI affordance. */
  passkeysCount: z.number().int().nonnegative(),
  /** Subset of `passkeysCount` that are PRF-capable (can unwrap the
   *  KEK on their own). Drives the §6.1 mode-max gate: activating
   *  `maximum` requires `passkeysPrfCount >= 1`. */
  passkeysPrfCount: z.number().int().nonnegative(),
  /** True when TOTP is fully enabled (`mfa_totp.enabled_at IS NOT
   *  NULL`). Required to activate modes `always_totp` / `maximum`
   *  (Auth-Spec §6.1). Pending enrollments (`enabled_at IS NULL`)
   *  read as `false` so the UI can offer to resume the flow. */
  totpEnabled: z.boolean(),
  /** Number of unused backup codes remaining. The UI surfaces a
   *  warning when this drops to 0 (Auth-Spec §8.3 — regen prompt). */
  totpBackupCodesRemaining: z.number().int().nonnegative(),
  /** Per-user security policy (Auth-Spec §6.1). */
  securityMode: z.enum(['password_or_passkey', 'always_totp', 'maximum']),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
