/**
 * OPAQUE wrapper — server side (Auth-Roadmap Phase 2).
 *
 * Thin shim over `@serenity-kit/opaque`'s `server.*` namespace so the
 * rest of the codebase doesn't import the lib directly. Two reasons:
 *
 *   1. Single chokepoint to enforce that `await ready` has resolved
 *      before any call (the lib boots a WASM module on first import
 *      and all functions throw if you call them too early).
 *   2. Centralised access to `OPAQUE_SERVER_SETUP` — the rest of the
 *      app pulls in `getOpaqueServerSetup()` instead of poking
 *      `getConfig().OPAQUE_SERVER_SETUP` directly, so the missing-env
 *      error message is consistent across routes.
 *
 * Phase 2A only ships the wrapper + a Vitest round-trip; live
 * register / login routes start consuming it in 2B / 2C.
 */
import { ready, server } from '@serenity-kit/opaque';
import { getConfig } from '../config.ts';

/**
 * Resolves once the WASM core is initialised. `await` it from any
 * route handler before calling the wrapper functions. We re-export
 * the lib's promise rather than wrap our own — same identity, same
 * memoisation, no risk of two callers waiting on diverging promises.
 */
export const opaqueReady: Promise<void> = ready;

/**
 * Returns the server static setup string (output of
 * `server.createSetup()`, base64url). Throws if the env var is
 * missing — call sites that hit OPAQUE routes should treat that as
 * a config bug, not a runtime fallback.
 */
export function getOpaqueServerSetup(): string {
  const cfg = getConfig();
  if (!cfg.OPAQUE_SERVER_SETUP) {
    throw new Error(
      'OPAQUE_SERVER_SETUP is not set. Generate one with `pnpm --filter @nodea/api exec node --input-type=module -e "import { ready, server } from \'@serenity-kit/opaque\'; await ready; console.log(server.createSetup())"` and put it in `.env` (or Infisical → api/).',
    );
  }
  return cfg.OPAQUE_SERVER_SETUP;
}

/**
 * Server-side leg of OPAQUE registration: takes the client's
 * `registrationRequest` and the `userIdentifier` (we use the lower-
 * cased email per Auth-Spec §7.1bis) and returns the response blob
 * the client needs to finish registration.
 *
 * The server doesn't store anything at this stage — the persisted
 * `registrationRecord` arrives in the *finish* call from the client
 * and lands in `opaque_records.envelope`.
 */
export interface RegistrationResponseInput {
  userIdentifier: string;
  registrationRequest: string;
}

export function createRegistrationResponse(
  input: RegistrationResponseInput,
): { registrationResponse: string } {
  const serverSetup = getOpaqueServerSetup();
  return server.createRegistrationResponse({
    serverSetup,
    userIdentifier: input.userIdentifier,
    registrationRequest: input.registrationRequest,
  });
}

/**
 * Server-side leg of OPAQUE login start. Loads the previously stored
 * `registrationRecord` (from `opaque_records.envelope`) and produces
 * a `loginResponse` + a `serverLoginState` that the route MUST stash
 * (typically on a short-lived `register` / `login` cookie) until the
 * client comes back with `finishLogin`.
 *
 * `registrationRecord = null` is allowed by the lib and produces a
 * fake-but-indistinguishable response — this is how OPAQUE hides
 * "unknown identifier" from a probing attacker. We pass through that
 * behaviour as-is.
 */
export interface LoginStartInput {
  userIdentifier: string;
  startLoginRequest: string;
  registrationRecord: string | null;
}

export function startLogin(input: LoginStartInput): {
  serverLoginState: string;
  loginResponse: string;
} {
  const serverSetup = getOpaqueServerSetup();
  return server.startLogin({
    serverSetup,
    userIdentifier: input.userIdentifier,
    registrationRecord: input.registrationRecord,
    startLoginRequest: input.startLoginRequest,
  });
}

/**
 * Server-side leg of OPAQUE login finish. Verifies the client's
 * `finishLoginRequest` against the `serverLoginState` produced by
 * `startLogin`, returning the symmetric `sessionKey` (which we
 * currently discard — Phase 2 keeps the existing
 * Hono signed-cookie session model rather than binding the cookie
 * to the OPAQUE session key).
 */
export interface LoginFinishInput {
  serverLoginState: string;
  finishLoginRequest: string;
}

export function finishLogin(input: LoginFinishInput): { sessionKey: string } {
  return server.finishLogin({
    serverLoginState: input.serverLoginState,
    finishLoginRequest: input.finishLoginRequest,
  });
}
