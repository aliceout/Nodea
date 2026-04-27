import { z } from 'zod';

/**
 * Wire schemas for the OPAQUE register / login two-step protocol
 * (Auth-Roadmap Phase 2, Auth-Spec §7.1bis + §7.2).
 *
 * The protocol runs in two HTTP round-trips:
 *
 *     Register
 *     ─────────
 *     POST /auth/register/opaque/start  { email, registrationRequest }
 *                                       → { registrationResponse }
 *     POST /auth/register/opaque/finish { email, registrationRecord,
 *                                         wrappedMainKey, wrappedMainKeyIv,
 *                                         wrappedKekPassword,
 *                                         wrappedKekPasswordIv,
 *                                         username, ... }
 *                                       → { ok, userId }
 *
 *     Login
 *     ─────
 *     POST /auth/login/opaque/start     { email, startLoginRequest }
 *                                       → { loginResponse, loginToken }
 *     POST /auth/login/opaque/finish    { loginToken, finishLoginRequest }
 *                                       → { ok, ... }
 *
 * The /start step is anti-enumeration: when the email is unknown
 * the server still returns a syntactically valid but
 * cryptographically dead `loginResponse` that will fail at the
 * client's finish step (export_key never matches). See
 * Auth-Spec §7.2 + §15.2.
 *
 * Schemas only — Phase 2A doesn't wire any route to them yet;
 * they're consumed in 2B (register) and 2C (login).
 */

const Base64ish = z.string().min(1).max(8192);
/**
 * `@serenity-kit/opaque` blobs are base64url, sometimes long. The
 * loose ceiling here is just a DoS safeguard — any genuine value is
 * well under 1 KiB.
 */
const OpaqueBlob = z.string().min(1).max(8192);

/* ============================================================================
 * Register
 * ========================================================================== */

export const OpaqueRegisterStartBodySchema = z.object({
  email: z.string().email().max(254),
  registrationRequest: OpaqueBlob,
});
export type OpaqueRegisterStartBody = z.infer<
  typeof OpaqueRegisterStartBodySchema
>;

export const OpaqueRegisterStartResponseSchema = z.object({
  registrationResponse: OpaqueBlob,
});
export type OpaqueRegisterStartResponse = z.infer<
  typeof OpaqueRegisterStartResponseSchema
>;

/**
 * Body of `POST /auth/register/opaque/finish`. Carries the OPAQUE
 * registration record (what the server persists in
 * `opaque_records.envelope`) plus every blob the client computed
 * locally from `exportKey`: the main-key envelope and the
 * password-wrapped KEK. Username + invite + open-registration logic
 * lives in 2B's route handler — kept here as the wire contract.
 */
export const OpaqueRegisterFinishBodySchema = z.object({
  email: z.string().email().max(254),
  username: z.string().min(2).max(32),
  registrationRecord: OpaqueBlob,
  wrappedMainKey: Base64ish,
  wrappedMainKeyIv: Base64ish,
  wrappedKekPassword: Base64ish,
  wrappedKekPasswordIv: Base64ish,
  inviteToken: z.string().min(16).max(256).optional(),
});
export type OpaqueRegisterFinishBody = z.infer<
  typeof OpaqueRegisterFinishBodySchema
>;

/* ============================================================================
 * Login
 * ========================================================================== */

export const OpaqueLoginStartBodySchema = z.object({
  email: z.string().email().max(254),
  startLoginRequest: OpaqueBlob,
});
export type OpaqueLoginStartBody = z.infer<typeof OpaqueLoginStartBodySchema>;

/**
 * The `loginToken` is a server-issued opaque blob keyed on the
 * pending `serverLoginState`. Implementation choice deferred to 2C
 * (signed JWT-lite vs server-side cache vs short-lived cookie); the
 * wire contract just requires it round-trips unchanged from start
 * to finish.
 */
export const OpaqueLoginStartResponseSchema = z.object({
  loginResponse: OpaqueBlob,
  loginToken: z.string().min(1).max(2048),
});
export type OpaqueLoginStartResponse = z.infer<
  typeof OpaqueLoginStartResponseSchema
>;

export const OpaqueLoginFinishBodySchema = z.object({
  loginToken: z.string().min(1).max(2048),
  finishLoginRequest: OpaqueBlob,
});
export type OpaqueLoginFinishBody = z.infer<
  typeof OpaqueLoginFinishBodySchema
>;
