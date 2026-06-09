/**
 * Passkey login orchestrator (Auth-Roadmap Phase 4C, Auth-Spec
 * §7.3 + §9).
 *
 * Split out of the original `passkey-flow.ts` (REFACTO-07) — kept
 * separate from [`./enroll.ts`](./enroll.ts) because the flows are
 * distinct (enrollment writes a new auth_factor + wraps the KEK
 * under PRF ; login authenticates via assertion + unwraps the
 * existing KEK + main key on the way back).
 *
 * Drives `apiPasskeyLoginStart` → `startAuthentication` →
 * `apiPasskeyLoginFinish`, extracts the PRF output from the
 * assertion's `clientExtensionResults`, and returns the raw blobs.
 * The caller (in `session/passkeys.ts`) is responsible for
 * unwrapping `kek = unwrapKekUnderPrf(prf, wrappedKek)` and then
 * `mainKey = unwrapMainKeyUnderKek(kek, wrappedMainKey)`.
 *
 * The session cookie is set by the server on /finish — this helper
 * only deals with credential / wrap material.
 */
import {
  startAuthentication,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';

import {
  apiPasskeyLoginFinish,
  apiPasskeyLoginStart,
} from '../../api/client.ts';

import { augmentWithPrfEval, readPrfFirst } from './shared.ts';

export interface PasskeyLoginInput {
  /** Optional. Server returns generic options with no
   *  `allowCredentials` filter when omitted (discoverable-creds path,
   *  user picks the account from the OS UI). */
  email?: string;
}

export interface PasskeyLoginRawResult {
  userId: string;
  credentialId: string;
  prfSupported: boolean;
  /** PRF output, surfaced from `clientExtensionResults.prf.results.first`.
   *  Always present when `prfSupported = true` AND the authenticator
   *  honours the eval input on assertion (which all PRF-supporting
   *  browsers do — Chrome / Safari). */
  prfOutput: Uint8Array | null;
  /** Wrap blobs returned alongside the session — the caller unwraps
   *  the KEK + main key from these (Phase 4C orchestration). */
  wrappedKek: string | null;
  wrappedKekIv: string | null;
  wrappedMainKey: string;
  wrappedMainKeyIv: string;
  /** Phase 5C — when `users.security_mode != 'password_or_passkey'`,
   *  the server emits a `mfa_pending` session instead of a `full`
   *  one and surfaces the additional factors the client must drive
   *  before the session is promoted. `false` = already full. */
  needsMfa: boolean;
  factorsNeeded: ReadonlyArray<'totp' | 'passkey' | 'password'>;
  /** Issue #72 — alternatives flag. Always false for passkey-first
   *  today (the matrix has no OR set in that direction). Kept for
   *  shape parity. */
  secondFactorChoice: boolean;
}

export async function loginWithPasskey(
  input: PasskeyLoginInput,
): Promise<PasskeyLoginRawResult> {
  const startRes = await apiPasskeyLoginStart(
    input.email !== undefined ? { email: input.email } : {},
  );

  const optionsJSON = augmentWithPrfEval(startRes.requestOptions);
  // Wire-frontier casts (ex-`as any`, audit 2026-06) — named targets
  // so the compiler keeps checking everything downstream.
  const assertion = await startAuthentication({
    optionsJSON:
      optionsJSON as unknown as PublicKeyCredentialRequestOptionsJSON,
  });

  const finishRes = await apiPasskeyLoginFinish({
    loginToken: startRes.loginToken,
    assertionResponse: assertion as unknown as Record<string, unknown>,
  });

  const prfOutput = readPrfFirst(
    assertion.clientExtensionResults as Record<string, unknown> | undefined,
  );

  return {
    userId: finishRes.userId,
    credentialId: finishRes.credentialId,
    prfSupported: finishRes.prfSupported,
    prfOutput,
    wrappedKek: finishRes.wrappedKek,
    wrappedKekIv: finishRes.wrappedKekIv,
    wrappedMainKey: finishRes.wrappedMainKey,
    wrappedMainKeyIv: finishRes.wrappedMainKeyIv,
    needsMfa: finishRes.needsMfa,
    factorsNeeded: finishRes.factorsNeeded,
    secondFactorChoice: finishRes.secondFactorChoice === true,
  };
}
