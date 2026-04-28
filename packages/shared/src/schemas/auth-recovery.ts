import { z } from 'zod';

/**
 * Recovery-code KEK schemas (Auth-Roadmap Phase 3, Auth-Spec §7.7).
 *
 * Two server-side surfaces:
 *
 *   1. **Setup / regenerate** (authenticated user, Settings).
 *      The client locally generates a fresh BIP39 mnemonic, derives
 *      a wrap key from the entropy via `HKDF(entropy, "nodea:wrap-kek")`,
 *      wraps the user's KEK, computes `SHA-256(entropy)` as the
 *      anti-DoS hash, ships everything in one POST. First-time setup
 *      and regenerate share the same body shape — only the gating
 *      differs server-side (regenerate requires the OPAQUE password
 *      proof, setup just needs the session).
 *
 *   2. **Recover flow** (anonymous, 2-step OPAQUE). /start collects
 *      the `email` + the new password's OPAQUE `registrationRequest`,
 *      returns the user's `wrappedKekRecovery` blobs + a fresh
 *      `registrationResponse` + a single-use `recoverSessionId`.
 *      The client unwraps the KEK locally with the typed mnemonic,
 *      runs `client.finishRegistration` for the new password, and
 *      ships everything to /finish in one call. /finish validates
 *      the recovery-code hash in constant time, replaces every
 *      credential blob in a transaction.
 */

const Base64ish = z.string().min(1).max(2048);
const OpaqueBlob = z.string().min(1).max(8192);
/** SHA-256 hex of 16 entropy bytes — exactly 64 hex chars. */
const Sha256Hex = z.string().regex(/^[0-9a-f]{64}$/);

/* ============================================================================
 * Setup / regenerate (authenticated)
 * ========================================================================== */

/**
 * `POST /auth/security/recovery-code` — body shared by first-time
 * setup and regenerate from Settings.
 *
 * `wrappedKekRecovery{,Iv}` = AES-GCM ciphertext + IV of the user's
 * KEK under `wk_recovery = HKDF(entropy, "nodea:wrap-kek")`.
 * AAD = `nodea:v1\x1f<userId>\x1frecovery`.
 *
 * `recoveryCodeHash` = `SHA-256(entropy)` — the server stores it
 * as-is for offline comparison at recover time.
 *
 * Re-auth is gated by the `requireFreshPassword` middleware
 * (Phase 7B); the body carries only the wrap blobs + the anti-DoS
 * hash. First-time setup right after register passes naturally
 * because the new full session is stamped fresh; regenerate from
 * Settings goes through the standard re-auth modal first.
 */
export const RecoveryCodeUpsertBodySchema = z.object({
  wrappedKekRecovery: Base64ish,
  wrappedKekRecoveryIv: Base64ish,
  recoveryCodeHash: Sha256Hex,
});
export type RecoveryCodeUpsertBody = z.infer<typeof RecoveryCodeUpsertBodySchema>;

/* ============================================================================
 * Recover flow (anonymous, 2-step OPAQUE folded with the recovery handshake)
 * ========================================================================== */

/**
 * `POST /auth/recover-kek/start` — kicks off the 2-step recover
 * flow. Anonymous: the user typed an email but we can't trust
 * them with "this email exists" / "doesn't exist".
 *
 * Server response shape is identical for known and unknown
 * identifiers (timing + body indistinguishable, anti-enum). The
 * `wrappedKekRecovery` blob is real for known emails and fresh
 * random bytes for unknown ones; `recoverSessionId` is single-use,
 * 5 min TTL.
 *
 * The OPAQUE `registrationResponse` for the new password is
 * computed and returned here too — saves a round-trip vs splitting
 * the OPAQUE register handshake into its own pair of routes.
 */
export const RecoverKekStartBodySchema = z.object({
  email: z.string().email().max(254),
  /** OPAQUE `registrationRequest` produced by `client.startRegistration`
   *  on the new password. */
  registrationRequest: OpaqueBlob,
});
export type RecoverKekStartBody = z.infer<typeof RecoverKekStartBodySchema>;

export const RecoverKekStartResponseSchema = z.object({
  recoverSessionId: z.string().min(1).max(2048),
  wrappedKekRecovery: Base64ish,
  wrappedKekRecoveryIv: Base64ish,
  /** UserId, returned for known users so the client can compute
   *  AAD bindings. For unknown emails this is a fresh random UUID
   *  that won't validate any hash — anti-enum. */
  userId: z.string().uuid(),
  /** OPAQUE `registrationResponse` for the new password. */
  registrationResponse: OpaqueBlob,
});
export type RecoverKekStartResponse = z.infer<
  typeof RecoverKekStartResponseSchema
>;

/**
 * `POST /auth/recover-kek/finish` — consumes the recover session,
 * validates the recovery-code hash in constant time, replaces
 * everything in a transaction.
 *
 *   - `recoverSessionId` from /start (single-use).
 *   - `recoveryCodeHash` (SHA-256 hex) — anti-DoS gate, compared
 *     constant-time against the stored value.
 *   - The full new credential set:
 *     - OPAQUE `registrationRecord` (new password)
 *     - `wrappedKekPassword{,Iv}` (KEK re-wrapped under new exportKey)
 *     - `wrappedKekRecoveryNew{,Iv}` + `recoveryCodeHashNew` (the
 *       old code is invalidated; the user must save the new one).
 *
 * The new BIP39 mnemonic is generated client-side and shown on
 * success; it never crosses the wire.
 */
export const RecoverKekFinishBodySchema = z.object({
  recoverSessionId: z.string().min(1).max(2048),
  recoveryCodeHash: Sha256Hex,
  registrationRecord: OpaqueBlob,
  wrappedKekPassword: Base64ish,
  wrappedKekPasswordIv: Base64ish,
  wrappedKekRecoveryNew: Base64ish,
  wrappedKekRecoveryNewIv: Base64ish,
  recoveryCodeHashNew: Sha256Hex,
});
export type RecoverKekFinishBody = z.infer<typeof RecoverKekFinishBodySchema>;
