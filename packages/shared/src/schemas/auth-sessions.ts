/**
 * Schemas for the « Sessions actives » API surface (issue #47).
 *
 * Read API : `GET /auth/sessions` returns the user's active full
 * sessions, with the encrypted device label as opaque base64
 * blobs. The server never decrypts ; the client renders.
 *
 * Mutate API : `DELETE /auth/sessions/:id` revokes one,
 * `POST /auth/logout-all` revokes every session of the user,
 * `PATCH /auth/sessions/current/device-label` writes the
 * encrypted label of the current session.
 */
import { z } from 'zod';

export const ActiveSessionSchema = z.object({
  id: z.string(),
  /** True when this row is the session matching the caller's
   *  cookie. The UI should disable the « Révoquer » button on
   *  this row (use the dedicated `/auth/logout` endpoint). */
  isCurrent: z.boolean(),
  createdAt: z.string(),
  /** ISO 8601, may be null if the session has never been touched
   *  since creation. */
  lastSeenAt: z.string().nullable(),
  /** Encrypted device label (issue #47). Null when the client
   *  hasn't PATCHed one yet. The companion IV is in
   *  `deviceLabelIv` ; both null or both non-null. */
  deviceLabelCipher: z.string().nullable(),
  deviceLabelIv: z.string().nullable(),
});
export type ActiveSession = z.infer<typeof ActiveSessionSchema>;

export const ListActiveSessionsResponseSchema = z.object({
  sessions: z.array(ActiveSessionSchema),
});
export type ListActiveSessionsResponse = z.infer<
  typeof ListActiveSessionsResponseSchema
>;

export const PatchCurrentSessionDeviceLabelBodySchema = z.object({
  /** Base64 AES-GCM ciphertext of the device label string. */
  cipher: z.string().min(1),
  /** Base64 12-byte IV. */
  iv: z.string().min(1),
});
export type PatchCurrentSessionDeviceLabelBody = z.infer<
  typeof PatchCurrentSessionDeviceLabelBodySchema
>;
