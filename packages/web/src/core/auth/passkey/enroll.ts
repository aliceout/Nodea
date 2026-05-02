/**
 * Passkey enrollment orchestrator (Auth-Roadmap Phase 4,
 * Auth-Spec §7.3 + §9).
 *
 * Split out of the original `passkey-flow.ts` (REFACTO-07) — the
 * enrollment dance is independent of the login one (which lives
 * in [`./login.ts`](./login.ts)) and the two were sharing a
 * single 530-LOC file. Common helpers live in
 * [`./shared.ts`](./shared.ts).
 *
 * Flow (Auth-Spec §9.2) :
 *   1. OPAQUE password proof → unwrap KEK locally.
 *   2. POST `/auth/passkey/enroll/start` with the proof.
 *   3. Server returns WebAuthn `creationOptions` carrying the PRF
 *      extension request. Persist the challenge on the session row.
 *   4. `startRegistration(creationOptions)` triggers the browser /
 *      OS passkey UI. User confirms with PIN/biometric.
 *   5. Inspect the resulting `clientExtensionResults.prf` for
 *      whether the authenticator surfaced a PRF output :
 *      - PRF output present (Safari, some Chromium builds) → derive
 *        `wk_passkey = HKDF(prf, …)`, wrap KEK, register as
 *        PRF-capable.
 *      - PRF declared (`enabled: true`) but no output (Bitwarden,
 *        1Password browser extensions, Chrome platform passkeys
 *        >= v123 — they defer the output to the first assertion) →
 *        run an immediate **calibration assertion** locally to
 *        extract the output, then wrap as above. The assertion is
 *        never submitted to the server ; it's a purely local
 *        extraction (the user gets a second OS prompt right after
 *        registration).
 *      - No PRF at all → register as login-only with a warning.
 *   6. POST `/auth/passkey/enroll/finish` with the attestation,
 *      label, prfSupported flag, wrap blobs.
 */
import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser';
import type { Base64 } from '@nodea/shared';

import {
  apiLoginStart,
  apiPasskeyEnrollFinish,
  apiPasskeyEnrollStart,
} from '../../api/client.ts';
import {
  bytesToBase64Url,
  randomBytes,
} from '../../crypto/base64.ts';
import {
  buildKekAAD,
  unwrapKekUnderFactor,
} from '../../crypto/factor-wrap.ts';
import {
  PRF_INPUT_V1,
  wrapKekUnderPrf,
} from '../../crypto/passkey-prf.ts';
import { clientLoginFinish, clientLoginStart, opaqueReady } from '../opaque.ts';

import {
  augmentWithPrfEval,
  readPrfEnabled,
  readPrfFirst,
} from './shared.ts';

/* ============================================================================
 * Types
 * ========================================================================== */

export interface EnrollPasskeyInput {
  /** The currently-signed-in user. We need their id (for AAD), email
   *  (for OPAQUE proof), and the wrapped KEK blobs. */
  user: {
    id: string;
    email: string;
    wrappedKekPassword: string | null;
    wrappedKekPasswordIv: string | null;
  };
  /** Plain-text password — OPAQUE proof rederives the export_key
   *  locally. Never sent to the server. */
  currentPassword: string;
  /** User-facing label for the credential, e.g. "iPhone perso". */
  label: string;
}

export interface EnrollPasskeyResult {
  /** Server-generated credential id (UUID PK in `auth_factors`). */
  id: string;
  /** True if PRF was surfaced + the KEK is now wrappable by this
   *  credential. False = login-only — the user keeps needing their
   *  password to unlock data on this credential. */
  prfSupported: boolean;
}

/* ============================================================================
 * Re-derive KEK from password (OPAQUE proof + unwrap)
 * ========================================================================== */

/**
 * Run a one-shot OPAQUE login start/finish pair locally to derive
 * the user's export_key, then unwrap the KEK from
 * `wrappedKekPassword`. Returns the live `loginToken` +
 * `finishLoginRequest` so the caller can use them as a server-side
 * password proof in the same minute (5-min TTL).
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` when the
 * password is wrong (`clientLoginFinish` returns `undefined`).
 */
async function deriveKekFromPassword(
  user: EnrollPasskeyInput['user'],
  currentPassword: string,
): Promise<{
  kekBytes: Uint8Array;
  proofLoginToken: string;
  proofFinishLoginRequest: string;
}> {
  if (
    user.wrappedKekPassword === null ||
    user.wrappedKekPasswordIv === null
  ) {
    throw new Error('deriveKekFromPassword: missing OPAQUE wrap blobs');
  }
  await opaqueReady;

  const proofClient = clientLoginStart(currentPassword);
  const proofStart = await apiLoginStart({
    email: user.email,
    startLoginRequest: proofClient.startLoginRequest,
  });
  const proofFinished = clientLoginFinish({
    password: currentPassword,
    clientLoginState: proofClient.clientLoginState,
    loginResponse: proofStart.loginResponse,
  });
  if (!proofFinished) {
    throw { status: 401, error: 'invalid_credentials' };
  }

  const kekBytes = await unwrapKekUnderFactor(
    {
      wrappedKek: user.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: user.wrappedKekPasswordIv as unknown as Base64,
    },
    proofFinished.exportKey,
    buildKekAAD(user.id, 'password'),
  );

  return {
    kekBytes,
    proofLoginToken: proofStart.loginToken,
    proofFinishLoginRequest: proofFinished.finishLoginRequest,
  };
}

/* ============================================================================
 * enrollPasskey
 * ========================================================================== */

export async function enrollPasskey(
  input: EnrollPasskeyInput,
): Promise<EnrollPasskeyResult> {
  const { user, currentPassword, label } = input;

  const proof = await deriveKekFromPassword(user, currentPassword);
  const { kekBytes, proofLoginToken, proofFinishLoginRequest } = proof;
  try {
    // Step 2-3: ask the server for creationOptions.
    const startRes = await apiPasskeyEnrollStart({
      proofLoginToken,
      proofFinishLoginRequest,
    });

    // Step 4: drive the browser passkey UI. The PRF eval input is
    // injected client-side into the options we received from the
    // server — that way the constant lives in one place
    // (`passkey-prf.ts`) and the server doesn't have to know about it.
    const optionsJSON = augmentWithPrfEval(startRes.creationOptions);
    const attestation = await startRegistration({
      // The runtime shape matches `PublicKeyCredentialCreationOptionsJSON`
      // — we narrowed via Zod's `record(string, unknown)` for transit
      // and don't want to duplicate the WebAuthn type schema.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      optionsJSON: optionsJSON as any,
    });

    const credentialIdB64Url = attestation.id;
    const transports = readTransports(attestation);

    // Step 5: extract PRF output. Two paths:
    //   - present in attestation → use directly (Safari, some Chrome
    //     builds);
    //   - PRF enabled but no output → calibration assertion (Bitwarden,
    //     1Password, Chrome v123+).
    let prfFirst = readPrfFirst(
      attestation.clientExtensionResults as Record<string, unknown> | undefined,
    );
    if (
      prfFirst === null &&
      readPrfEnabled(
        attestation.clientExtensionResults as Record<string, unknown> | undefined,
      )
    ) {
      prfFirst = await runCalibrationAssertion({
        creationOptions: startRes.creationOptions,
        credentialIdB64Url,
        transports,
      });
    }

    let prfSupported = false;
    let wrappedKek: string | null = null;
    let wrappedKekIv: string | null = null;
    if (prfFirst) {
      prfSupported = true;
      try {
        const wrap = await wrapKekUnderPrf(
          kekBytes,
          prfFirst,
          user.id,
          credentialIdB64Url,
        );
        wrappedKek = wrap.wrappedKek;
        wrappedKekIv = wrap.wrappedKekIv;
      } finally {
        prfFirst.fill(0);
      }
    }

    // Step 6: ship the attestation + PRF status + wrap blobs.
    const finishRes = await apiPasskeyEnrollFinish({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      attestationResponse: attestation as any,
      label,
      prfSupported,
      wrappedKek,
      wrappedKekIv,
      transports,
    });

    return finishRes;
  } finally {
    kekBytes.fill(0);
  }
}

/* ============================================================================
 * Calibration assertion — extract PRF output from a deferred-PRF cred
 * ========================================================================== */

interface CalibrationInput {
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
async function runCalibrationAssertion(
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      optionsJSON: requestOptions as any,
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

/* ============================================================================
 * Helpers (private to enroll)
 * ========================================================================== */

function readTransports(attestation: { response?: { transports?: string[] } }): string | null {
  const t = attestation.response?.transports;
  if (!t || t.length === 0) return null;
  return t.join(',');
}
