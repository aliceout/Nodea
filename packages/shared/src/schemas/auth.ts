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
  email: z.email().max(254),
  password: z.string().min(12).max(200),
  inviteCode: z.string().min(1).max(128),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type RegisterBody = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.email().max(254),
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
export const ChangePasswordStartBodySchema = z.object({
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
 * Change the authenticated user's email. Re-auth gated by the
 * `requireFreshPassword` middleware (Phase 7B); the body carries
 * only the new address.
 *
 * The encrypted envelope doesn't change: the email isn't part of
 * any KEK derivation in V1. The OPAQUE `userIdentifier` is the
 * email though, so a future Phase 2+ "change email = re-register
 * OPAQUE" flow will need to ship a fresh `registrationRecord` here.
 * V1 keeps this minimal — the server just updates the `email` column.
 */
export const ChangeEmailBodySchema = z.object({
  newEmail: z.email().max(254),
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
  .regex(/^[\p{L}\p{N}_.-]+$/u, { error: 'invalid_username' });

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
 * Self-delete the authenticated user. Re-auth gated by the
 * `requireFreshPassword` middleware (Phase 7B). Per Auth-Spec §6 / §7.11 the
 * handler ALSO requires a fresh passkey assertion when a passkey is enrolled
 * and a live TOTP code when TOTP is enabled — the code rides here; the passkey
 * proof is stamped out-of-band via `/auth/reauth/passkey`.
 */
export const DeleteSelfBodySchema = z.object({
  /** Live TOTP code — mandatory server-side when the account has TOTP enabled;
   *  ignored otherwise. Kept lenient in length (a 6-digit code today). */
  totpCode: z.string().min(1).max(24).optional(),
});
export type DeleteSelfBody = z.infer<typeof DeleteSelfBodySchema>;

/**
 * Ask for a password-reset email. Anonymous route — the response is
 * always 200 whether or not the email matches a user, to avoid
 * enumeration via response shape / latency.
 */
export const RequestResetBodySchema = z.object({
  email: z.email().max(254),
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
  userId: z.uuid(),
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
  email: z.email().max(254),
  expiresAt: z.iso.datetime().optional(),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBodySchema>;

/**
 * `GET /auth/me` — identity, role, MFA flags. Called on every page
 * load (sidebar, header, ProtectedRoute), so the response stays
 * lean : no crypto blobs.
 *
 * The OPAQUE wrap blobs (`wrappedMainKey`, `wrappedKekPassword`, …)
 * live behind a separate endpoint, [`AuthMeCryptoResponseSchema`]
 * below — fetched only at the moments where the client actually
 * unwraps the KEK (change-password, recovery code setup, passkey
 * enrollment). API-14 split rationale: ~2 KB per `/me` hit was
 * spent shipping crypto blobs that 95 % of callers never touch.
 */
export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  username: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  onboardingStatus: z.enum(['pending', 'complete']),
  onboardingVersion: z.string(),
  /** True when the user has set up a recovery code (Auth-Roadmap
   *  Phase 3). The actual `users.recovery_code_hash` value never
   *  leaves the server; we just flag presence so the UI can show
   *  the "set me up" warning vs the "regenerate" button. */
  recoveryCodeSet: z.boolean(),
  /** True when the user is overdue to re-prove they still hold their
   *  recovery phrase (Auth-Roadmap Phase 3B, Auth-Spec §7.7). Computed
   *  server-side from `recovery_verified_at` + `recovery_verify_streak`
   *  via a lazy backoff ladder (6 wk → 3 mo → 6 mo → 1 yr); the client
   *  only reacts to the boolean. Always `false` when no code is set —
   *  that case is the `recoveryCodeSet` warning's job instead. */
  recoveryReverifyDue: z.boolean(),
  /** Total number of passkeys enrolled (`auth_factors WHERE
   *  kind='passkey'`). Drives the sidebar "configure a passkey" tip
   *  (visible at 0) and the Settings UI affordance. */
  passkeysCount: z.number().int().nonnegative(),
  /** Subset of `passkeysCount` that are PRF-capable (can unwrap the
   *  KEK on their own). Drives the §6.1 mode-max gate: activating
   *  `maximum` requires `passkeysPrfCount >= 1`. */
  passkeysPrfCount: z.number().int().nonnegative(),
  /** True when TOTP is fully enabled (`mfa_totp.enabled_at IS NOT
   *  NULL`). Required to activate modes `always_2fa` / `maximum`
   *  (Auth-Spec §6.1). Pending enrollments (`enabled_at IS NULL`)
   *  read as `false` so the UI can offer to resume the flow. */
  totpEnabled: z.boolean(),
  /** Number of unused backup codes remaining. The UI surfaces a
   *  warning when this drops to 0 (Auth-Spec §8.3 — regen prompt). */
  totpBackupCodesRemaining: z.number().int().nonnegative(),
  /** Per-user security policy (Auth-Spec §6.1). */
  securityMode: z.enum(['password_or_passkey', 'always_2fa', 'maximum']),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;

/**
 * `GET /auth/me/crypto` — OPAQUE wrap blobs (API-14 split).
 *
 * 2-layer wrap (Auth-Spec §7.1) :
 *   - main key under a random KEK → `wrappedMainKey` /
 *     `wrappedMainKeyIv` (set ONCE at register, never re-wrapped).
 *   - KEK under an HKDF sub-key of OPAQUE's `exportKey` →
 *     `wrappedKekPassword` / `wrappedKekPasswordIv` (re-wrapped at
 *     change-password and reset).
 *
 * Fields are nullable because a user row created without an
 * envelope (test seed inserting a row by hand) reads back as null.
 * The client treats null as « this account is broken /
 * unrecoverable » and surfaces a key-missing prompt.
 *
 * Called only at unwrap moments :
 *   - change-password : derive KEK from old password, re-wrap under new.
 *   - recovery-code setup : derive KEK from password, wrap under code.
 *   - passkey enroll : derive KEK from password, wrap under PRF.
 */
export const AuthMeCryptoResponseSchema = z.object({
  wrappedMainKey: Base64ish.nullable(),
  wrappedMainKeyIv: Base64ish.nullable(),
  wrappedKekPassword: Base64ish.nullable(),
  wrappedKekPasswordIv: Base64ish.nullable(),
});
export type AuthMeCryptoResponse = z.infer<typeof AuthMeCryptoResponseSchema>;
