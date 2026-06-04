import { z } from 'zod';
import { UsernameField } from './auth.ts';

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
  email: z.email().max(254),
  registrationRequest: OpaqueBlob,
  /** Optional invite token — sent at /start so the server can pre-
   *  validate the strict email match before burning a round-trip on
   *  a doomed registration. The actual invite consumption happens at
   *  /finish, in a transaction with the user insert. */
  inviteToken: z.string().min(16).max(256).optional(),
});
export type OpaqueRegisterStartBody = z.infer<
  typeof OpaqueRegisterStartBodySchema
>;

/**
 * `/start` returns the OPAQUE response blob plus a fresh `userId`
 * (UUIDv4). The client uses that `userId` to compute AAD bindings
 * for `wrappedMainKey` and `wrappedKekPassword` BEFORE calling
 * `/finish`. The server doesn't persist the userId at this point —
 * it's just a value the client must echo back at finish time.
 *
 * Using a server-issued userId (rather than client-side
 * `crypto.randomUUID()`) keeps a single ID source and makes the AAD
 * fields predictable for the seed script and any future migration
 * tooling.
 */
export const OpaqueRegisterStartResponseSchema = z.object({
  registrationResponse: OpaqueBlob,
  userId: z.uuid(),
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
  email: z.email().max(254),
  username: UsernameField,
  /** Server-issued at /start — echoed back so the server can use it
   *  as the new `users.id` PK. AAD bindings on the wrapped blobs
   *  reference this same value, so the client must NOT regenerate
   *  it locally. */
  userId: z.uuid(),
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
  email: z.email().max(254),
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

/**
 * `POST /auth/login/finish` response — discriminated by `needsMfa`.
 *
 * - `needsMfa: false` — pre-Phase-5C path. Session is already `full`,
 *   the cookie is set, the client hits `/auth/me` to load the user
 *   shape and proceed normally.
 * - `needsMfa: true` — Phase 5C stepped MFA. The session is
 *   `mfa_pending` with `mfa_password_verified=true`; the client
 *   must drive `/auth/mfa/totp/verify` (and Phase 5D's passkey-as-
 *   second-factor for mode `maximum`) before the session is
 *   promoted to `full`.
 *
 *   When `needsMfa` is true, the server inlines the wrap blobs the
 *   client would normally fetch via `/auth/me` — that endpoint
 *   refuses `mfa_pending` sessions, so the client would otherwise
 *   be unable to unwrap the KEK before MFA finalization. Per
 *   Auth-Spec §7.2.bis the client unwraps the KEK + main key
 *   immediately on the exportKey it just derived; the data is
 *   unreachable until the session is promoted (no full cookie =
 *   no data routes), so there's no leak.
 */
const Base64ishLogin = z.string().min(1).max(8192);
export const OpaqueLoginFinishResponseSchema = z.discriminatedUnion(
  'needsMfa',
  [
    z.object({
      needsMfa: z.literal(false),
      id: z.string(),
    }),
    z.object({
      needsMfa: z.literal(true),
      id: z.string(),
      factorsNeeded: z.array(z.enum(['totp', 'passkey'])).min(1),
      /**
       * Issue #72 — when true, the listed factors are alternatives
       * (verifying any ONE finalizes the session). When false / absent,
       * every listed factor is required in turn (current `maximum`
       * behaviour). The flat `factorsNeeded` list alone can't
       * disambiguate `['totp', 'passkey']` between « pick one » and
       * « do both » ; the client uses this flag to decide whether to
       * surface a picker on `/login/mfa`.
       */
      secondFactorChoice: z.boolean().optional(),
      wrappedMainKey: Base64ishLogin,
      wrappedMainKeyIv: Base64ishLogin,
      wrappedKekPassword: Base64ishLogin,
      wrappedKekPasswordIv: Base64ishLogin,
    }),
  ],
);
export type OpaqueLoginFinishResponse = z.infer<
  typeof OpaqueLoginFinishResponseSchema
>;
