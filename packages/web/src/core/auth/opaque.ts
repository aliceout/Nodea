/**
 * OPAQUE wrapper — client side (Auth-Roadmap Phase 2).
 *
 * Thin shim over `@serenity-kit/opaque`'s `client.*` namespace,
 * mirroring `packages/api/src/auth/opaque.ts` server-side. Same
 * goals: a single chokepoint that awaits the WASM `ready` promise
 * and a stable surface the rest of the web code targets, so
 * swapping the underlying lib (or upgrading it) only touches this
 * file.
 *
 * Phase 2A only ships the wrapper + a server-side round-trip test;
 * Register / Login wire it in 2B and 2C.
 */
import { client, ready } from '@serenity-kit/opaque';

/** Awaited once before the first `start*` call — the lib boots WASM lazily. */
export const opaqueReady: Promise<void> = ready;

/* ============================================================================
 * Registration (run during /auth/register submit)
 * ========================================================================== */

export interface ClientRegisterStartResult {
  /** Sealed state to pass back to {@link clientRegisterFinish}. Opaque blob. */
  clientRegistrationState: string;
  /** Wire payload for `POST /auth/register/opaque/start`. */
  registrationRequest: string;
}

/**
 * Step 1 of OPAQUE registration: the client commits to a password
 * by producing a `registrationRequest` the server will respond to.
 * Caller is responsible for awaiting {@link opaqueReady} once before
 * the very first call (subsequent calls reuse the resolved promise).
 */
export function clientRegisterStart(password: string): ClientRegisterStartResult {
  return client.startRegistration({ password });
}

export interface ClientRegisterFinishInput {
  password: string;
  clientRegistrationState: string;
  /** Server response from `POST /auth/register/opaque/start`. */
  registrationResponse: string;
}

export interface ClientRegisterFinishResult {
  /** Wire payload for `POST /auth/register/opaque/finish` — gets stored
   *  in `opaque_records.envelope` server-side. */
  registrationRecord: string;
  /** 32-byte symmetric key (hex) the client uses to derive `wk_password`
   *  via HKDF label `nodea:wrap-kek`. NEVER ship this to the server. */
  exportKey: string;
  /** Server's static public key — caller may pin it to detect a server
   *  swap. We don't (yet); pin lookups can land in Phase 2C if useful. */
  serverStaticPublicKey: string;
}

/**
 * Step 2 of OPAQUE registration: the client folds the server's
 * response into a final `registrationRecord` (the envelope the
 * server will persist) and derives `exportKey` — the symmetric key
 * we use to wrap the KEK. The `password` is consumed here too;
 * callers should hand it directly from the form value, never store
 * it.
 */
export function clientRegisterFinish(
  input: ClientRegisterFinishInput,
): ClientRegisterFinishResult {
  return client.finishRegistration({
    password: input.password,
    clientRegistrationState: input.clientRegistrationState,
    registrationResponse: input.registrationResponse,
  });
}

/* ============================================================================
 * Login (run during /auth/login)
 * ========================================================================== */

export interface ClientLoginStartResult {
  clientLoginState: string;
  startLoginRequest: string;
}

export function clientLoginStart(password: string): ClientLoginStartResult {
  return client.startLogin({ password });
}

export interface ClientLoginFinishInput {
  password: string;
  clientLoginState: string;
  /** Server response from `POST /auth/login/opaque/start`. */
  loginResponse: string;
}

export interface ClientLoginFinishResult {
  /** Wire payload for `POST /auth/login/opaque/finish`. */
  finishLoginRequest: string;
  /** Symmetric session key — we currently discard it (Hono signed
   *  cookies remain authoritative); the field is kept on the surface
   *  for parity with the server lib. */
  sessionKey: string;
  /** Same `exportKey` as registration — KEK unwrap key. */
  exportKey: string;
  serverStaticPublicKey: string;
}

/**
 * Step 2 of OPAQUE login. Returns `undefined` if the server's
 * `loginResponse` doesn't validate (wrong password, tampered blob,
 * fake response from a server that doesn't have the registration
 * record). Callers MUST treat that as authentication failure.
 */
export function clientLoginFinish(
  input: ClientLoginFinishInput,
): ClientLoginFinishResult | null {
  const result = client.finishLogin({
    password: input.password,
    clientLoginState: input.clientLoginState,
    loginResponse: input.loginResponse,
  });
  return result ?? null;
}

/* ============================================================================
 * Re-auth helper (Auth-Roadmap Phase 7B)
 *
 * Pre-7B every mutating Settings call shipped a one-shot OPAQUE
 * proof in its body; the server consumed it, verified it inline,
 * then ran the action. 7B moved that to a session-scoped
 * `reauth_password_at` timestamp gated by the
 * `requireFreshPassword` middleware, so the front does the OPAQUE
 * round-trip out-of-band against `/auth/reauth/password` and the
 * subsequent action just rides on the now-fresh session.
 * ========================================================================== */

import {
  apiReauthPasswordFinish,
  apiReauthPasswordStart,
} from '../api/client.ts';

/**
 * Prove the user knows the typed password and bump
 * `reauth_password_at = now()` on the calling session. The OPAQUE
 * round-trip uses the dedicated `/auth/reauth/password/{start,
 * finish}` endpoints so the user identifier is taken from the
 * session (anti-confused-deputy).
 *
 * Returns the OPAQUE `exportKey` because callers that re-derive a
 * KEK locally (change-password, recovery-code regenerate) need the
 * fresh derivation. Most callers ignore the return value.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` when the
 * password doesn't match — the SPA surfaces that as "Mot de passe
 * actuel incorrect."
 */
export async function freshenPasswordReauth(
  password: string,
): Promise<{ exportKey: string }> {
  await opaqueReady;
  const { clientLoginState, startLoginRequest } = clientLoginStart(password);
  const start = await apiReauthPasswordStart({ startLoginRequest });
  const finished = clientLoginFinish({
    password,
    clientLoginState,
    loginResponse: start.loginResponse,
  });
  if (!finished) {
    throw {
      status: 401,
      error: 'invalid_credentials',
    };
  }
  await apiReauthPasswordFinish({
    loginToken: start.loginToken,
    finishLoginRequest: finished.finishLoginRequest,
  });
  return { exportKey: finished.exportKey };
}
