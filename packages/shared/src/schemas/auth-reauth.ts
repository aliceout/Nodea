/**
 * Zod DTOs for step-up re-auth (password + passkey, start/finish).
 *
 * Where: packages/shared — shared by the api `/auth/reauth/*` routes and
 * the web re-auth helper. The proof is a fresh OPAQUE / WebAuthn round-
 * trip, not an embedded password.
 */
import { z } from 'zod';

/**
 * Re-auth endpoints (Auth-Roadmap Phase 7A, Auth-Spec §5.3).
 *
 * Lets a logged-in user prove a factor freshly without going through
 * a full re-login. The mutating Settings actions then pass the
 * `requireFreshPassword` / `requireFreshPasswordOrPasskey`
 * middleware which checks `sessions.reauth_*_at` — bumped here on
 * success.
 *
 *   - `POST /auth/reauth/password/start`  → OPAQUE login start
 *   - `POST /auth/reauth/password/finish` → OPAQUE login finish,
 *                                            bumps `reauth_password_at`
 *   - `POST /auth/reauth/passkey/start`   → WebAuthn assertion options
 *   - `POST /auth/reauth/passkey/finish`  → assertion verify,
 *                                            bumps `reauth_passkey_at`
 *
 * The user identifier on the password path is taken from the
 * session, NOT from the body — `requireUser` already resolved it,
 * so an attacker holding A's session cookie can't run a password
 * proof against B's record.
 */

/* ============================================================================
 * Password re-auth
 * ========================================================================== */

export const ReauthPasswordStartBodySchema = z.object({
  startLoginRequest: z.string().min(1),
});
export type ReauthPasswordStartBody = z.infer<
  typeof ReauthPasswordStartBodySchema
>;

export const ReauthPasswordStartResponseSchema = z.object({
  loginResponse: z.string(),
  loginToken: z.string(),
});
export type ReauthPasswordStartResponse = z.infer<
  typeof ReauthPasswordStartResponseSchema
>;

export const ReauthPasswordFinishBodySchema = z.object({
  loginToken: z.string().min(1),
  finishLoginRequest: z.string().min(1),
});
export type ReauthPasswordFinishBody = z.infer<
  typeof ReauthPasswordFinishBodySchema
>;

/* ============================================================================
 * Passkey re-auth
 *
 * Same WebAuthn shapes as the stepped-MFA passkey routes — the only
 * difference is the route runs against a `full` session and bumps
 * `reauth_passkey_at` instead of finalizing an `mfa_pending` row.
 * ========================================================================== */

export const ReauthPasskeyStartBodySchema = z.looseObject({});
export type ReauthPasskeyStartBody = z.infer<
  typeof ReauthPasskeyStartBodySchema
>;

const WebAuthnOptionsJSON = z.record(z.string(), z.unknown());
export const ReauthPasskeyStartResponseSchema = z.object({
  requestOptions: WebAuthnOptionsJSON,
});
export type ReauthPasskeyStartResponse = z.infer<
  typeof ReauthPasskeyStartResponseSchema
>;

const WebAuthnResponseJSON = z.record(z.string(), z.unknown());
export const ReauthPasskeyFinishBodySchema = z.object({
  assertionResponse: WebAuthnResponseJSON,
});
export type ReauthPasskeyFinishBody = z.infer<
  typeof ReauthPasskeyFinishBodySchema
>;

/* ============================================================================
 * Common 200 shape
 * ========================================================================== */

export const ReauthOkResponseSchema = z.object({ ok: z.literal(true) });
export type ReauthOkResponse = z.infer<typeof ReauthOkResponseSchema>;
