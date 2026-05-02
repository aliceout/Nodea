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
 * `POST /auth/passkeys/enroll/start` — body. Empty in V2 (Phase 7B):
 * fresh-password gating moved to the `requireFreshPassword`
 * middleware. Kept as an explicit schema for symmetry.
 */
export const PasskeyEnrollStartBodySchema = z.object({}).passthrough();
export type PasskeyEnrollStartBody = z.infer<typeof PasskeyEnrollStartBodySchema>;

/**
 * `POST /auth/passkeys/enroll/start` — response. Returns the WebAuthn
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
 * `POST /auth/passkeys/enroll/finish` — body. The `attestationResponse`
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

/**
 * `meta` payload for the passkey list. `prfCount` was a top-level
 * field before the API-06 envelope migration; it now lives inside
 * `meta` so the response shape matches the rest of the GET-list
 * endpoints.
 *
 * `auth_factors WHERE kind='passkey' AND prf_supported=true` count.
 * Drives §6.1 mode-max activation gates client-side.
 */
export const PasskeyListMetaSchema = z.object({
  prfCount: z.number().int().nonnegative(),
});
export type PasskeyListMeta = z.infer<typeof PasskeyListMetaSchema>;

export const PasskeyListResponseSchema = z.object({
  data: z.array(PasskeyListItemSchema),
  meta: PasskeyListMetaSchema,
});
export type PasskeyListResponse = z.infer<typeof PasskeyListResponseSchema>;

export const PasskeyRenameBodySchema = z.object({
  label: z.string().min(1).max(120),
});
export type PasskeyRenameBody = z.infer<typeof PasskeyRenameBodySchema>;

/**
 * `POST /auth/passkeys/:id/remove` and `PATCH /auth/passkeys/:id/label`
 * both require a fresh password (matrice §6). Phase 7B moved that
 * gate to the `requireFreshPassword` middleware so the bodies carry
 * only the route-specific payload (delete has none; rename has the
 * new label).
 */
export const PasskeyDeleteBodySchema = z.object({}).passthrough();
export type PasskeyDeleteBody = z.infer<typeof PasskeyDeleteBodySchema>;

export const PasskeyRenameWithProofBodySchema = z.object({
  label: z.string().min(1).max(120),
});
export type PasskeyRenameWithProofBody = z.infer<
  typeof PasskeyRenameWithProofBodySchema
>;

/* ============================================================================
 * Login passkey-first — anonymous
 * ========================================================================== */

/**
 * `POST /auth/passkeys/login/start` — body. `email` is optional: the
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
 * `POST /auth/passkeys/login/start` — response. Server-side state is
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
 * `POST /auth/passkeys/login/finish` — response. The session cookie is
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
/**
 * Phase 4 base shape — userId / credentialId / wrap blobs the
 * client needs to unwrap. Phase 5C extends with `needsMfa` so the
 * passkey path can also drop into stepped MFA when
 * `users.security_mode != 'password_or_passkey'`.
 *
 * `needsMfa = true` means the session was emitted as `mfa_pending`
 * with `mfa_passkey_verified = true`; the client drives the next
 * step (TOTP today, password-as-second-factor in Phase 5D for mode
 * `maximum`).
 */
export const PasskeyLoginFinishResponseSchema = z.object({
  userId: z.string(),
  credentialId: z.string(),
  prfSupported: z.boolean(),
  wrappedKek: Base64ish.nullable(),
  wrappedKekIv: Base64ish.nullable(),
  wrappedMainKey: Base64ish,
  wrappedMainKeyIv: Base64ish,
  /** Stepped MFA flag. When false, the session is already `full`. */
  needsMfa: z.boolean(),
  /** Factors still missing before the server will promote to full.
   *  Empty when `needsMfa = false`. */
  factorsNeeded: z.array(z.enum(['totp', 'passkey', 'password'])),
});
export type PasskeyLoginFinishResponse = z.infer<
  typeof PasskeyLoginFinishResponseSchema
>;
