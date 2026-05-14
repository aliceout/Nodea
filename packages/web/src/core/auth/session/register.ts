import { apiRegisterFinish, apiRegisterStart } from '../../api/client.ts';
import { randomBytes } from '../../crypto/base64.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '../../crypto/factor-wrap.ts';
import { clientRegisterFinish, clientRegisterStart, opaqueReady } from '../opaque.ts';

import type { SessionRegisterInput, SessionRegisterResult } from './types.ts';

/**
 * Submit a new registration (Auth-Roadmap Phase 2B — OPAQUE).
 *
 * Three layers of crypto run client-side:
 *
 *   1. OPAQUE registration handshake (`/start` + `/finish` round-
 *      trips). The server gets a `registrationRequest` then a
 *      `registrationRecord`; the password itself never leaves the
 *      client. We derive `exportKey` here too — that's the secret
 *      we use to wrap the KEK.
 *   2. A fresh random KEK + main key are generated. The main key
 *      is wrapped under the KEK (label `nodea:wrap-main`, AAD
 *      bound to the userId). This wrap is set ONCE at register
 *      and never re-wrapped — change-password rotates the KEK
 *      envelope, not this one.
 *   3. The KEK is wrapped under an HKDF sub-key of `exportKey`
 *      (label `nodea:wrap-kek`, AAD bound to userId + "password").
 *
 * No session cookie is emitted by the server. Per UX decision the
 * user retypes their password on /login?activated=1 once the
 * account is ready — we wipe the in-memory key material here.
 */
export async function submitRegistration(
  input: SessionRegisterInput,
): Promise<SessionRegisterResult> {
  await opaqueReady;

  // OPAQUE step 1: produce the registrationRequest. We hold onto
  // `clientRegistrationState` until the server responds.
  const { clientRegistrationState, registrationRequest } = clientRegisterStart(
    input.password,
  );

  // /start round-trip: server returns its OPAQUE response + a
  // fresh userId we use as the AAD anchor for the wrapped blobs.
  const startBody: Parameters<typeof apiRegisterStart>[0] = {
    email: input.email,
    registrationRequest,
  };
  if (input.inviteToken) startBody.inviteToken = input.inviteToken;
  const startRes = await apiRegisterStart(startBody);
  const userId = startRes.userId;

  // OPAQUE step 2: combine the response with our state to derive
  // the persisted registrationRecord + the local exportKey.
  const finished = clientRegisterFinish({
    password: input.password,
    clientRegistrationState,
    registrationResponse: startRes.registrationResponse,
  });

  // KEK + main key generation + wrapping.
  const kek = randomBytes(32);
  const rawMainKey = randomBytes(32);
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

    const finishBody: Parameters<typeof apiRegisterFinish>[0] = {
      email: input.email,
      username: input.username,
      userId,
      registrationRecord: finished.registrationRecord,
      wrappedMainKey: mainKeyWrap.wrappedMainKey,
      wrappedMainKeyIv: mainKeyWrap.wrappedMainKeyIv,
      wrappedKekPassword: kekWrap.wrappedKek,
      wrappedKekPasswordIv: kekWrap.wrappedKekIv,
    };
    if (input.inviteToken) finishBody.inviteToken = input.inviteToken;
    const finishRes = await apiRegisterFinish(finishBody);

    const result: SessionRegisterResult = { activated: finishRes.activated };
    if (finishRes.email !== undefined) result.email = finishRes.email;
    return result;
  } finally {
    kek.fill(0);
    rawMainKey.fill(0);
  }
}
