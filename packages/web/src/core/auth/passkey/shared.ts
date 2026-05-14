/**
 * Shared helpers between the passkey enrollment + login orchestrators.
 *
 * Extracted from the original `passkey-flow.ts` (REFACTO-07) so each
 * orchestrator file stays focused on its own dance. Three things live
 * here :
 *   - `readPrfFirst()` : extract `clientExtensionResults.prf.results.first`
 *     from a registration or assertion response. Used by both flows.
 *   - `readPrfEnabled()` : detect the `prf.enabled === true` flag that
 *     some authenticators surface at registration without a populated
 *     `results.first` (Bitwarden, 1Password browser extensions, Chrome
 *     platform passkeys ≥ v123). Currently only enroll consumes it,
 *     but it's PRF-related and lives with `readPrfFirst`.
 *   - `augmentWithPrfEval()` : inject the fixed PRF eval input into a
 *     creationOptions / requestOptions object. Same dance for both
 *     flows — keeping the constant in one place keeps the server
 *     agnostic about which PRF input version we use.
 *
 * **Critical encoding note** documented on `augmentWithPrfEval` —
 * `prf.eval.first` MUST be raw bytes, not base64url. The bug it
 * guards against is silent (the PRF request never reaches the
 * authenticator and `prf.enabled` is absent from the response).
 */
import { PRF_INPUT_V1 } from '../../crypto/passkey-prf.ts';

interface PrfClientOutput {
  enabled?: boolean;
  results?: {
    first?: ArrayBuffer | Uint8Array;
    second?: ArrayBuffer | Uint8Array;
  };
}

/**
 * Extract the PRF `first` output from `clientExtensionResults`.
 * Returns `null` when the authenticator didn't surface one (either
 * non-PRF, or PRF support was reported via `enabled: true` but
 * results are deferred to the next assertion).
 *
 * The `prf` field isn't in DOM lib types yet, so we narrow through
 * an `unknown`-keyed record.
 */
export function readPrfFirst(
  results: Record<string, unknown> | undefined,
): Uint8Array | null {
  if (!results || typeof results !== 'object') return null;
  const prf = (results as { prf?: unknown }).prf;
  if (!prf || typeof prf !== 'object') return null;
  const out = prf as PrfClientOutput;
  const first = out.results?.first;
  if (!first) return null;
  return first instanceof Uint8Array ? first : new Uint8Array(first);
}

/**
 * Detect `prf.enabled === true` in the registration response. Some
 * authenticators (Bitwarden, 1Password browser extensions, Chrome
 * platform passkeys >= v123) return this flag without a populated
 * `results.first` — the PRF output is deferred to the first assertion.
 * When this is true but `readPrfFirst` returned `null`, the enroll
 * flow does an immediate calibration assertion to extract the output
 * before finishing enrollment.
 */
export function readPrfEnabled(
  results: Record<string, unknown> | undefined,
): boolean {
  if (!results || typeof results !== 'object') return false;
  const prf = (results as { prf?: unknown }).prf;
  if (!prf || typeof prf !== 'object') return false;
  return (prf as { enabled?: unknown }).enabled === true;
}

/**
 * Inject our fixed PRF input into the creationOptions or
 * requestOptions before handing them to `startRegistration` /
 * `startAuthentication`. The server doesn't include the concrete
 * bytes — it only signals "PRF extension requested". Adding
 * `eval.first` here keeps the constant in one place
 * (`passkey-prf.ts`) and lets the server stay agnostic about which
 * version of the PRF input the client is using.
 *
 * **Critical encoding note**: `prf.eval.first` MUST be a `BufferSource`
 * (Uint8Array / ArrayBuffer), not a base64url string. The
 * `@simplewebauthn/browser` lib does not decode extension values
 * before forwarding the options to `navigator.credentials.{create,get}`
 * — it spreads `optionsJSON` and only converts the well-known fields
 * (challenge, user.id, excludeCredentials.id, allowCredentials.id).
 * Anything passed as a string here gets ignored silently by
 * Firefox / Chrome, the authenticator never sees the PRF request,
 * and `prf.enabled` is absent from the response. We therefore keep
 * raw bytes here.
 */
export function augmentWithPrfEval(
  options: Record<string, unknown>,
): Record<string, unknown> {
  const cloned: Record<string, unknown> = { ...options };
  const existingExt =
    (cloned.extensions as Record<string, unknown> | undefined) ?? {};
  cloned.extensions = {
    ...existingExt,
    prf: {
      eval: {
        first: PRF_INPUT_V1,
      },
    },
  };
  return cloned;
}
