/**
 * Calibration assertion : extract PRF output from a deferred-PRF
 * credential immediately after enrollment.
 *
 * Some authenticators (Bitwarden, 1Password browser extensions,
 * Chrome platform passkeys >= v123) report `prf.enabled === true`
 * at registration but defer the actual PRF output to the first
 * assertion. Without this calibration step, those authenticators
 * would have to fall back to login-only enrollment — losing the
 * KEK-wrap-under-PRF that lets the user unlock data with a single
 * passkey tap on every subsequent login.
 *
 * Extracted from `enroll.ts` (REFACTO-07 follow-up) to keep enroll
 * under the 200-300 LOC factor-early ceiling. The calibration is
 * self-contained — it generates its own challenge client-side and
 * **never submits the resulting assertion to the server**. We only
 * consume `clientExtensionResults.prf.results.first` and discard
 * the rest.
 */
import {
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

import { bytesToBase64Url, randomBytes } from '../../crypto/base64.ts';
import { PRF_INPUT_V1 } from '../../crypto/passkey-prf.ts';

import { readPrfFirst } from './shared.ts';

export interface CalibrationInput {
  /** Original creationOptions — we read `rp.id` from here so the
   *  assertion targets the right relying party. */
  creationOptions: Record<string, unknown>;
  /** Just-enrolled credential id (base64url). */
  credentialIdB64Url: string;
  /** Transports we got back from registration, fed into the
   *  assertion's `allowCredentials` to hint the browser. `null`
   *  means we don't constrain. */
  transports: string | null;
}

/**
 * Drive a `startAuthentication` call locally to extract the PRF
 * output for a credential whose authenticator deferred it past
 * registration.
 *
 * The challenge is generated client-side (32 bytes random) and the
 * resulting assertion is **never submitted to the server** — we
 * only consume `clientExtensionResults.prf.results.first` and throw
 * the rest away. That bypasses the need for a server round-trip
 * and keeps the calibration step entirely local.
 *
 * Returns `null` when:
 *   - the user cancels the OS prompt (`NotAllowedError`);
 *   - the authenticator silently refuses (no output surfaces);
 *   - any other WebAuthn error.
 *
 * Caller falls back to login-only enrollment in those cases.
 */
export async function runCalibrationAssertion(
  input: CalibrationInput,
): Promise<Uint8Array | null> {
  const { creationOptions, credentialIdB64Url, transports } = input;

  const rpId =
    (creationOptions.rp as Record<string, unknown> | undefined)?.id;
  const challenge = bytesToBase64Url(randomBytes(32));

  const transportsList =
    transports !== null && transports.length > 0
      ? transports.split(',').map((t) => t.trim()).filter((t) => t.length > 0)
      : undefined;

  const requestOptions: Record<string, unknown> = {
    challenge,
    userVerification: 'required',
    allowCredentials: [
      transportsList !== undefined
        ? {
            id: credentialIdB64Url,
            type: 'public-key',
            transports: transportsList,
          }
        : { id: credentialIdB64Url, type: 'public-key' },
    ],
    // PRF eval input MUST be raw bytes here for the same reason as
    // augmentWithPrfEval — see the note there. base64url string would
    // be silently dropped by the browser.
    extensions: { prf: { eval: { first: PRF_INPUT_V1 } } },
  };
  if (typeof rpId === 'string' && rpId.length > 0) {
    requestOptions.rpId = rpId;
  }

  let assertion;
  try {
    assertion = await startAuthentication({
      optionsJSON:
        requestOptions as unknown as PublicKeyCredentialRequestOptionsJSON,
    });
  } catch {
    // User dismissed the WebAuthn prompt, or no credential was
    // available for this rpId. Either way it's not an error worth
    // surfacing — the caller treats null as "PRF unavailable" and
    // falls back to a password-driven unlock.
    return null;
  }

  return readPrfFirst(
    assertion.clientExtensionResults as Record<string, unknown> | undefined,
  );
}
