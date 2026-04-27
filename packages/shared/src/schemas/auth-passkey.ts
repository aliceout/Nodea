import { z } from 'zod';

/**
 * Passkey schemas (Auth-Roadmap Phase 4, Auth-Spec §7.3 + §9).
 *
 * WebAuthn enrollment + assertion are 2-step protocols that span two
 * HTTP round-trips each. The /start step generates a random challenge,
 * stores it server-side (on the session for enrollment, on a
 * single-use pending entry for login), and returns the
 * `PublicKeyCredentialCreationOptions` / `PublicKeyCredentialRequestOptions`
 * the browser feeds to `navigator.credentials.{create,get}`. The
 * /finish step verifies the resulting attestation / assertion against
 * the stored challenge.
 *
 * The wire format for WebAuthn responses is JSON-encoded by
 * `@simplewebauthn/browser`'s `startRegistration` / `startAuthentication`
 * helpers (they handle the ArrayBuffer ↔ base64url dance for us).
 * Server-side, `@simplewebauthn/server` consumes those JSON shapes
 * directly. We accept them through Zod as opaque records — schema
 * validation happens at the WebAuthn layer, not Zod.
 *
 * # Structure
 *
 *   - `Passkey*Enroll{Start,Finish}` : authenticated, settings UI.
 *   - `PasskeyListItem` / `PasskeyListResponse` : authenticated, list.
 *   - `PasskeyRenameBody` / `PasskeyDeleteBody` : authenticated.
 *   - `Passkey*Login{Start,Finish}` : anonymous, login flow.
 *
 * Wrapping detail (§9.2, §9.4):
 *   - `wrappedKek` + `wrappedKekIv` are AES-GCM ciphertext + IV of
 *     the user's KEK under `HKDF(prf_output, "nodea:wrap-kek")`.
 *   - AAD = `nodea:v1\x1f<userId>\x1fpasskey\x1f<credentialId>`.
 *   - Both are NULL when `prfSupported = false` — that credential is
 *     login-only (proves identity, can't unwrap data).
 */

const Base64ish = z.string().min(1).max(8192);

/**
 * `PublicKeyCredentialCreationOptionsJSON` / `PublicKeyCredentialRequestOptionsJSON`
 * shapes from `@simplewebauthn/server`. We re-validate the top-level
 * structure as `unknown` because the lib's TypeScript types are the
 * authoritative source — duplicating them in Zod adds maintenance
 * burden with zero safety win.
 */
const WebAuthnOptionsJSON = z.record(z.string(), z.unknown());

/** Same rationale for `RegistrationResponseJSON` / `AuthenticationResponseJSON`. */
const WebAuthnResponseJSON = z.record(z.string(), z.unknown());

/* ============================================================================
 * Enrollment — authenticated user, Settings → Passkeys → "Add"
 * ========================================================================== */

/**
 * `POST /auth/passkey/enroll/start` — body. The OPAQUE password proof
 * is required (matrice de re-auth §6: add/remove passkey ⇒ fresh
 * password). Same shape as `OpaquePasswordProofSchema` but inlined here
 * so the schema stays self-contained and discoverable from one import.
 */
export const PasskeyEnrollStartBodySchema = z.object({
  proofLoginToken: z.string().min(1).max(2048),
  proofFinishLoginRequest: Base64ish,
});
export type PasskeyEnrollStartBody = z.infer<typeof PasskeyEnrollStartBodySchema>;

/**
 * `POST /auth/passkey/enroll/start` — response. Returns the WebAuthn
 * `creationOptions` ready to feed `navigator.credentials.create`. The
 * challenge is stored on the user's `sessions` row
 * (`pending_webauthn_challenge`, TTL 5 min, single-use at /finish).
 */
export const PasskeyEnrollStartResponseSchema = z.object({
  creationOptions: WebAuthnOptionsJSON,
});
export type PasskeyEnrollStartResponse = z.infer<
  typeof PasskeyEnrollStartResponseSchema
>;

/**
 * `POST /auth/passkey/enroll/finish` — body. The `attestationResponse`
 * is the `RegistrationResponseJSON` produced by
 * `@simplewebauthn/browser`'s `startRegistration`. `prfSupported` plus
 * the optional `wrappedKek{,Iv}` carry the per-credential KEK wrap
 * (§9.2) — when null, the passkey is registered as login-only with a
 * client-side warning surfaced before submission.
 */
export const PasskeyEnrollFinishBodySchema = z.object({
  attestationResponse: WebAuthnResponseJSON,
  /** User-facing label, e.g. "Yubikey perso", "iPhone bureau".
   *  Required (no implicit default) so the list stays meaningful. */
  label: z.string().min(1).max(120),
  prfSupported: z.boolean(),
  /** AES-GCM ciphertext of the KEK. NULL ⇔ prfSupported === false. */
  wrappedKek: Base64ish.nullable(),
  wrappedKekIv: Base64ish.nullable(),
  /** Comma-separated transports list, e.g. "internal,hybrid". Ships
   *  to `allowCredentials` at login to nudge the browser toward the
   *  right authenticator. */
  transports: z.string().max(120).nullable(),
});
export type PasskeyEnrollFinishBody = z.infer<typeof PasskeyEnrollFinishBodySchema>;

export const PasskeyEnrollFinishResponseSchema = z.object({
  id: z.string(),
  prfSupported: z.boolean(),
});
export type PasskeyEnrollFinishResponse = z.infer<
  typeof PasskeyEnrollFinishResponseSchema
>;

/* ============================================================================
 * List / rename / delete
 * ========================================================================== */

export const PasskeyListItemSchema = z.object({
  id: z.string(),
  label: z.string().nullable(),
  prfSupported: z.boolean(),
  transports: z.string().nullable(),
  createdAt: z.string(),
  lastUsedAt: z.string().nullable(),
});
export type PasskeyListItem = z.infer<typeof PasskeyListItemSchema>;

export const PasskeyListResponseSchema = z.object({
  passkeys: z.array(PasskeyListItemSchema),
  /** `auth_factors WHERE kind='passkey' AND prf_supported=true` count.
   *  Drives §6.1 mode-max activation gates client-side. */
  prfCount: z.number().int().nonnegative(),
});
export type PasskeyListResponse = z.infer<typeof PasskeyListResponseSchema>;

export const PasskeyRenameBodySchema = z.object({
  label: z.string().min(1).max(120),
});
export type PasskeyRenameBody = z.infer<typeof PasskeyRenameBodySchema>;

/**
 * `POST /auth/passkey/:id/remove` and `PATCH /auth/passkey/:id/label`
 * both require a fresh OPAQUE password proof (matrice §6). The body
 * for delete is just the proof; rename adds the new label.
 */
export const PasskeyDeleteBodySchema = z.object({
  proofLoginToken: z.string().min(1).max(2048),
  proofFinishLoginRequest: Base64ish,
});
export type PasskeyDeleteBody = z.infer<typeof PasskeyDeleteBodySchema>;

export const PasskeyRenameWithProofBodySchema = z.object({
  label: z.string().min(1).max(120),
  proofLoginToken: z.string().min(1).max(2048),
  proofFinishLoginRequest: Base64ish,
});
export type PasskeyRenameWithProofBody = z.infer<
  typeof PasskeyRenameWithProofBodySchema
>;

/* ============================================================================
 * Login passkey-first — anonymous
 * ========================================================================== */

/**
 * `POST /auth/passkey/login/start` — body. `email` is optional: the
 * browser supports "discoverable" credentials (the user picks the
 * account from a system UI) so the server returns generic
 * `requestOptions` with no `allowCredentials` filter. When `email` is
 * provided and resolves to a known user, the response tightens
 * `allowCredentials` to that user's enrolled passkeys.
 */
export const PasskeyLoginStartBodySchema = z.object({
  email: z.string().email().max(254).optional(),
});
export type PasskeyLoginStartBody = z.infer<typeof PasskeyLoginStartBodySchema>;

/**
 * `POST /auth/passkey/login/start` — response. Server-side state is
 * keyed on `loginToken` (single-use, 5 min TTL); the challenge lives
 * inside the returned `requestOptions` AND is mirrored in the pending
 * entry so /finish can verify it without trusting the client to echo
 * it back faithfully.
 */
export const PasskeyLoginStartResponseSchema = z.object({
  requestOptions: WebAuthnOptionsJSON,
  loginToken: z.string().min(1).max(2048),
});
export type PasskeyLoginStartResponse = z.infer<
  typeof PasskeyLoginStartResponseSchema
>;

export const PasskeyLoginFinishBodySchema = z.object({
  loginToken: z.string().min(1).max(2048),
  assertionResponse: WebAuthnResponseJSON,
});
export type PasskeyLoginFinishBody = z.infer<typeof PasskeyLoginFinishBodySchema>;

/**
 * `POST /auth/passkey/login/finish` — response. The session cookie is
 * already set by the time the body comes back. The body carries the
 * KEK wrap blobs the client needs to unwrap data:
 *
 *   - `prfSupported = true` → `wrappedKek{,Iv}` are non-null and the
 *     client can derive the KEK from `prfOutput`.
 *   - `prfSupported = false` → both blobs are null. The client knows
 *     it has to chain a password login next (the assertion proved
 *     identity but can't unwrap data — Auth-Spec §9.4 cas non-PRF).
 *
 * `wrappedMainKey{,Iv}` are always non-null on a successful login —
 * they're the same blobs `/auth/me` would return, included here so
 * the client can finish the unwrap dance without an extra round-trip.
 */
export const PasskeyLoginFinishResponseSchema = z.object({
  userId: z.string(),
  credentialId: z.string(),
  prfSupported: z.boolean(),
  wrappedKek: Base64ish.nullable(),
  wrappedKekIv: Base64ish.nullable(),
  wrappedMainKey: Base64ish,
  wrappedMainKeyIv: Base64ish,
});
export type PasskeyLoginFinishResponse = z.infer<
  typeof PasskeyLoginFinishResponseSchema
>;
