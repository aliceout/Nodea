import { z } from 'zod';

const Base64ish = z.string().min(1);

/**
 * Registration payload.
 *
 * The server never derives the KEK — the client does. The client sends:
 *   - email, password (hashed server-side with argon2id for auth)
 *   - inviteCode (consumed atomically)
 *   - encryptionSalt (opaque bytes, base64) used client-side with argon2id
 *     to derive the KEK
 *   - encryptedKey (base64 AES-GCM blob = mainKey encrypted under KEK)
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
 * Change password. The client re-wraps the main key under a KEK derived from
 * the new password, and ships the fresh salt + wrapped key alongside the old
 * password (proof of knowledge).
 */
export const ChangePasswordBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(12).max(200),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type ChangePasswordBody = z.infer<typeof ChangePasswordBodySchema>;

/** Change the authenticated user's email. Current password required. */
export const ChangeEmailBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
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

/** Self-delete the authenticated user. Current password required. */
export const DeleteSelfBodySchema = z.object({
  currentPassword: z.string().min(1).max(200),
});
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
 * Consume a reset token. The client must generate a fresh main key
 * locally before calling this endpoint (resetting the password means
 * the old AES envelope is unreadable) and ships the new
 * `encryptionSalt` + `encryptedKey` alongside. The server atomically
 * purges every user-owned encrypted row before rotating the
 * credentials — see the handler for the full list.
 */
export const ResetPasswordBodySchema = z.object({
  token: z.string().min(16).max(256),
  newPassword: z.string().min(12).max(200),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
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
 * Two sets of credential blobs coexist during the OPAQUE migration:
 *
 *   - Legacy (`encryptionSalt` + `encryptedKey`): the Argon2id-based
 *     wrap of the main key under a password-derived KEK. Populated
 *     for accounts created before Phase 2B; NULL afterwards.
 *
 *   - OPAQUE (`wrappedMainKey{,Iv}` + `wrappedKekPassword{,Iv}`): the
 *     2-layer wrap landed in Phase 2B — main key under a random KEK,
 *     KEK under an HKDF sub-key of `exportKey`. Populated for accounts
 *     created in 2B onwards; NULL for legacy accounts.
 *
 * Each account is exclusively one or the other. The client picks
 * the unwrap path based on which set is present. Phase 2D drops
 * the legacy columns once the seeded admin is re-enrolled.
 */
export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().nullable(),
  role: z.enum(['user', 'admin']),
  onboardingStatus: z.enum(['pending', 'complete']),
  onboardingVersion: z.string(),
  encryptionSalt: Base64ish.nullable(),
  encryptedKey: Base64ish.nullable(),
  wrappedMainKey: Base64ish.nullable(),
  wrappedMainKeyIv: Base64ish.nullable(),
  wrappedKekPassword: Base64ish.nullable(),
  wrappedKekPasswordIv: Base64ish.nullable(),
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
