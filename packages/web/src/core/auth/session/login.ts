import type { Base64, LoginBody } from '@nodea/shared';

import {
  apiLoginFinish,
  apiLoginStart,
  apiMe,
  apiMeCrypto,
  apiMfaPasskeyFinish,
  apiMfaPasskeyStart,
  apiMfaTotpVerify,
} from '../../api/client.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  unwrapKekUnderFactor,
  unwrapMainKeyUnderKek,
} from '../../crypto/factor-wrap.ts';
import { deriveMainKeys } from '../../crypto/key-material.ts';
import { clientLoginFinish, clientLoginStart, opaqueReady } from '../opaque.ts';

import type { SetAuth, SetMainKey } from './types.ts';

interface LoginDeps {
  setAuth: SetAuth;
  setMainKey: SetMainKey;
}

/**
 * Drive an OPAQUE login. Returns a discriminated result so the
 * caller can branch on stepped-MFA:
 *
 *   - `{ needsMfa: false }` — session is `full`, the main key is
 *     unwrapped + stored, the user shape is hydrated. Caller
 *     navigates to `/flow`.
 *   - `{ needsMfa: true, factorsNeeded }` — session is `mfa_pending`.
 *     The main key IS already unwrapped client-side (the wrap
 *     blobs ride along the /finish response), so subsequent data
 *     access works as soon as the session is promoted by
 *     `/auth/mfa/totp/verify`. Caller navigates to `/login/mfa`.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a
 * wrong password (client-side `finishLogin` returns undefined).
 */
export async function login(
  deps: LoginDeps,
  body: LoginBody,
): Promise<
  | { needsMfa: false }
  | { needsMfa: true; factorsNeeded: ReadonlyArray<'totp' | 'passkey'> }
> {
  await opaqueReady;

  // OPAQUE step 1: build the local login state + the wire request.
  const { clientLoginState, startLoginRequest } = clientLoginStart(body.password);
  const startRes = await apiLoginStart({
    email: body.email,
    startLoginRequest,
  });

  // OPAQUE step 2: derive the export_key locally from the server's
  // response. `null` here means the server's response was a fake
  // (unknown identifier or dead handshake) — surface it as the
  // standard `invalid_credentials` shape so the UI doesn't have to
  // distinguish between "wrong email" and "wrong password".
  const finished = clientLoginFinish({
    password: body.password,
    clientLoginState,
    loginResponse: startRes.loginResponse,
  });
  if (!finished) {
    throw {
      status: 401,
      error: 'invalid_credentials',
    };
  }

  // Server-side verification + session emission. Either `full`
  // (needsMfa: false) or `mfa_pending` (needsMfa: true).
  const finishRes = await apiLoginFinish({
    loginToken: startRes.loginToken,
    finishLoginRequest: finished.finishLoginRequest,
  });

  if (finishRes.needsMfa) {
    // Stepped MFA branch (Auth-Roadmap Phase 5C). `/auth/me`
    // refuses pending sessions, so the wrap blobs ride inside the
    // /finish response — we unwrap immediately so subsequent
    // crypto ops have the key material ready by the time the
    // session is promoted to full.
    const kekBytes = await unwrapKekUnderFactor(
      {
        wrappedKek: finishRes.wrappedKekPassword as unknown as Base64,
        wrappedKekIv: finishRes.wrappedKekPasswordIv as unknown as Base64,
      },
      finished.exportKey,
      buildKekAAD(finishRes.id, 'password'),
    );
    let rawBytes: Uint8Array;
    try {
      rawBytes = await unwrapMainKeyUnderKek(
        {
          wrappedMainKey: finishRes.wrappedMainKey as unknown as Base64,
          wrappedMainKeyIv: finishRes.wrappedMainKeyIv as unknown as Base64,
        },
        kekBytes,
        buildMainKeyAAD(finishRes.id),
      );
    } finally {
      kekBytes.fill(0);
    }
    try {
      const material = await deriveMainKeys(rawBytes);
      deps.setMainKey(material);
    } finally {
      rawBytes.fill(0);
    }
    // The auth slice stays `null` until the MFA route promotes
    // and `/auth/me` succeeds — we don't have a public user
    // shape we can trust on a pending session. The route guard
    // handles `null` user + ready key as "still authenticating".
    return { needsMfa: true, factorsNeeded: finishRes.factorsNeeded };
  }

  // Full-session branch — original Phase 2C path.
  const me = await apiMe();
  if (!me) throw new Error('login succeeded but /auth/me returned null');
  deps.setAuth(me);

  // API-14 split — wrap blobs come from /auth/me/crypto, not /me.
  // Phase 2D dropped the legacy fallback — every authenticated
  // user has the OPAQUE blobs at this point (the seed enrolls the
  // admin via OPAQUE too).
  const crypto = await apiMeCrypto();
  if (
    crypto.wrappedMainKey === null ||
    crypto.wrappedMainKeyIv === null ||
    crypto.wrappedKekPassword === null ||
    crypto.wrappedKekPasswordIv === null
  ) {
    throw new Error('login: user row is missing the OPAQUE wrap blobs');
  }
  const kekBytes = await unwrapKekUnderFactor(
    {
      wrappedKek: crypto.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: crypto.wrappedKekPasswordIv as unknown as Base64,
    },
    finished.exportKey,
    buildKekAAD(me.id, 'password'),
  );
  let rawBytes: Uint8Array;
  try {
    rawBytes = await unwrapMainKeyUnderKek(
      {
        wrappedMainKey: crypto.wrappedMainKey as unknown as Base64,
        wrappedMainKeyIv: crypto.wrappedMainKeyIv as unknown as Base64,
      },
      kekBytes,
      buildMainKeyAAD(me.id),
    );
  } finally {
    kekBytes.fill(0);
  }

  try {
    const material = await deriveMainKeys(rawBytes);
    deps.setMainKey(material);
  } finally {
    rawBytes.fill(0);
  }
  return { needsMfa: false };
}

/**
 * Verify a TOTP code (or backup code) against the current
 * `mfa_pending` session. On finalize, hydrate `/auth/me` so the
 * auth slice flips to authenticated.
 *
 * Returns `{ finalized: true }` when the session is now `full` —
 * the caller navigates to `/flow`. Returns
 * `{ finalized: false, missing }` when more factors are needed
 * (e.g. mode `maximum` may still need passkey).
 */
export async function verifyMfaTotp(
  deps: { setAuth: SetAuth },
  code: string,
): Promise<
  | { finalized: true }
  | { finalized: false; missing: ReadonlyArray<'totp' | 'passkey' | 'password'> }
> {
  const res = await apiMfaTotpVerify({ code });
  if (res.finalized) {
    const me = await apiMe();
    if (!me) {
      throw new Error('mfa-totp verify finalized but /auth/me returned null');
    }
    deps.setAuth(me);
    return { finalized: true };
  }
  return { finalized: false, missing: res.missing };
}

/**
 * Drive a passkey-as-second-factor assertion (Phase 5D, mode
 * `maximum`). Requests WebAuthn `requestOptions` scoped to the
 * user's enrolled passkeys, runs `startAuthentication`, ships the
 * assertion back. On finalize hydrate `/auth/me`.
 *
 * Throws WebAuthn errors verbatim (caller distinguishes
 * `NotAllowedError` for user-cancel) and ApiError for server
 * rejects (401 = invalid assertion, 400 = stale challenge).
 */
export async function verifyMfaPasskey(
  deps: { setAuth: SetAuth },
): Promise<
  | { finalized: true }
  | { finalized: false; missing: ReadonlyArray<'totp' | 'passkey' | 'password'> }
> {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const startRes = await apiMfaPasskeyStart({});
  const assertion = await startAuthentication({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    optionsJSON: startRes.requestOptions as any,
  });
  const finishRes = await apiMfaPasskeyFinish({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assertionResponse: assertion as any,
  });
  if (finishRes.finalized) {
    const me = await apiMe();
    if (!me) {
      throw new Error('mfa-passkey verify finalized but /auth/me returned null');
    }
    deps.setAuth(me);
    return { finalized: true };
  }
  return { finalized: false, missing: finishRes.missing };
}
