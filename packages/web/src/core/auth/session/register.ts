import { apiRegisterFinish, apiRegisterStart } from '../../api/client.ts';
import { generateRecoveryMnemonic, sha256Hex } from '../../crypto/bip39.ts';
import { randomBytes } from '../../crypto/base64.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '../../crypto/factor-wrap.ts';
import { clientRegisterFinish, clientRegisterStart, opaqueReady } from '../opaque.ts';

import type { SessionRegisterInput, SessionRegisterResult } from './types.ts';

type FinishBody = Parameters<typeof apiRegisterFinish>[0];

export interface PreparedRegistration {
  /** The fresh 12-word recovery mnemonic — display ONCE (reveal + quiz) before
   *  the account is created, then drop it. The caller must NOT persist it. */
  mnemonic: string;
  /** The fully-wrapped register-finish payload (incl. the recovery blobs).
   *  Sent verbatim by `finishRegistration` once the user passes the quiz; no
   *  raw key material remains in it. */
  finishBody: FinishBody;
}

/**
 * Submit a new registration (Auth-Roadmap Phase 2B — OPAQUE), split in two so
 * the mandatory recovery-phrase ceremony can run in between (the recovery
 * factor is now forced at signup — issue, Auth-Spec §7.7).
 *
 * `prepareRegistration` does everything that needs the in-memory keys:
 *
 *   1. OPAQUE register handshake (`/start` + local finish) → `exportKey`.
 *   2. Fresh random KEK + main key; main key wrapped under the KEK
 *      (`nodea:wrap-main`, AAD bound to userId).
 *   3. KEK wrapped under an HKDF sub-key of `exportKey` (`nodea:wrap-kek`,
 *      AAD `…\x1fpassword`).
 *   4. Fresh BIP39 mnemonic; KEK ALSO wrapped under `HKDF(entropy)`
 *      (AAD `…\x1frecovery`) + `recoveryCodeHash = SHA-256(entropy)`.
 *
 * The raw bytes (KEK, main key, entropy) are zeroed here; only the wrapped
 * blobs + the mnemonic-for-display survive. `/finish` is NOT called yet — the
 * UI reveals the mnemonic + runs the transcription quiz, then calls
 * `finishRegistration` so abandoning at the quiz leaves NO account behind.
 */
export async function prepareRegistration(
  input: SessionRegisterInput,
): Promise<PreparedRegistration> {
  await opaqueReady;

  const { clientRegistrationState, registrationRequest } = clientRegisterStart(
    input.password,
  );

  const startBody: Parameters<typeof apiRegisterStart>[0] = {
    email: input.email,
    registrationRequest,
  };
  if (input.inviteToken) startBody.inviteToken = input.inviteToken;
  const startRes = await apiRegisterStart(startBody);
  const userId = startRes.userId;

  const finished = clientRegisterFinish({
    password: input.password,
    clientRegistrationState,
    registrationResponse: startRes.registrationResponse,
  });

  const kek = randomBytes(32);
  const rawMainKey = randomBytes(32);
  const { mnemonic, entropy } = generateRecoveryMnemonic();
  try {
    const mainKeyWrap = await wrapMainKeyUnderKek(
      rawMainKey,
      kek,
      buildMainKeyAAD(userId),
    );
    const kekWrap = await wrapKekUnderFactor(
      kek,
      finished.exportKey,
      buildKekAAD(userId, 'password'),
    );
    const recoveryWrap = await wrapKekUnderFactor(
      kek,
      entropy,
      buildKekAAD(userId, 'recovery'),
    );
    const recoveryCodeHash = await sha256Hex(entropy);

    const finishBody: FinishBody = {
      email: input.email,
      username: input.username,
      userId,
      registrationRecord: finished.registrationRecord,
      wrappedMainKey: mainKeyWrap.wrappedMainKey,
      wrappedMainKeyIv: mainKeyWrap.wrappedMainKeyIv,
      wrappedKekPassword: kekWrap.wrappedKek,
      wrappedKekPasswordIv: kekWrap.wrappedKekIv,
      wrappedKekRecovery: recoveryWrap.wrappedKek,
      wrappedKekRecoveryIv: recoveryWrap.wrappedKekIv,
      recoveryCodeHash,
    };
    if (input.inviteToken) finishBody.inviteToken = input.inviteToken;
    return { mnemonic, finishBody };
  } finally {
    kek.fill(0);
    rawMainKey.fill(0);
    entropy.fill(0);
  }
}

/**
 * Create the account: POST the prepared finish payload. Called once the user
 * has passed the recovery-phrase quiz. No session cookie is emitted — the user
 * retypes their password on `/login?activated=1`.
 */
export async function finishRegistration(
  finishBody: FinishBody,
): Promise<SessionRegisterResult> {
  const finishRes = await apiRegisterFinish(finishBody);
  const result: SessionRegisterResult = { activated: finishRes.activated };
  if (finishRes.email !== undefined) result.email = finishRes.email;
  return result;
}
