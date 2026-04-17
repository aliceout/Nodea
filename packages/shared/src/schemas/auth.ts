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

/** Admin-only payload to mint a new invite code. */
export const CreateInviteBodySchema = z.object({
  expiresAt: z.string().datetime().optional(),
});
export type CreateInviteBody = z.infer<typeof CreateInviteBodySchema>;

/** Response bodies — what the client can rely on without decrypting. */
export const AuthMeResponseSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']),
  onboardingStatus: z.enum(['pending', 'complete']),
  onboardingVersion: z.string(),
  encryptionSalt: Base64ish,
  encryptedKey: Base64ish,
});
export type AuthMeResponse = z.infer<typeof AuthMeResponseSchema>;
