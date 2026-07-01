import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/browser';
import type { Base64, LoginBody } from '@nodea/shared';

import {
  apiLoginFinish,
  apiLoginStart,
  apiMe,
  apiMeCrypto,
  apiMfaPasskeyFinish,
  apiMfaPasskeyStart,
  apiMfaPasswordFinish,
  apiMfaPasswordStart,
  apiMfaTotpVerify,
} from '../../api/client.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  buildSessionDeviceLabelAAD,
  unwrapKekUnderFactor,
  unwrapMainKeyUnderKek,
} from '../../crypto/factor-wrap.ts';
import { deriveMainKeys, type MainKeyMaterial } from '../../crypto/key-material.ts';
import { encryptMetaString } from '../../crypto/session-meta.ts';
import { apiPatchCurrentSessionDeviceLabel } from '../../api/sessions.ts';
import { parseDeviceLabel } from '../../../lib/device-label.ts';
import { clientLoginFinish, clientLoginStart, opaqueReady } from '../opaque.ts';

import type { MarkKeyMissing, SetAuth, SetMainKey } from './types.ts';

/**
 * Fire-and-forget : encrypt a coarse device hint (« MacBook » /
 * « iPhone » …) derived from the UA and PATCH it onto the just-minted
 * session. Without this a session shows « Appareil inconnu » until the
 * user happens to open Account (where SessionsCard PATCHes the current
 * row opportunistically). Labelling at login means every session
 * self-labels the moment it's created. Best-effort : a failure just
 * leaves the row unlabeled, retried on the next Account visit.
 */
function labelCurrentSession(material: MainKeyMaterial, userId: string): void {
  const hint = parseDeviceLabel(navigator.userAgent);
  const aad = buildSessionDeviceLabelAAD(userId);
  void encryptMetaString(hint.label, material.aesKey, aad)
    .then(({ cipher, iv }) => apiPatchCurrentSessionDeviceLabel({ cipher, iv }))
    .catch((err: unknown) => {
      if (import.meta.env.DEV) console.warn('device-label PATCH failed', err);
    });
}

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
  | {
      needsMfa: true;
      factorsNeeded: ReadonlyArray<'totp' | 'passkey'>;
      /** Issue #72 — true when factors are alternatives ; false /
       *  absent when each listed factor is required in sequence. */
      secondFactorChoice: boolean;
    }
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
    return {
      needsMfa: true,
      factorsNeeded: finishRes.factorsNeeded,
      secondFactorChoice: finishRes.secondFactorChoice === true,
    };
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
    labelCurrentSession(material, me.id);
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
  deps: { setAuth: SetAuth; markKeyMissing: MarkKeyMissing; hasMainKey: () => boolean },
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
    // A page reload during stepped MFA wipes the in-memory main key, and a
    // TOTP code carries no material to re-derive it (only the password 2nd-
    // factor path can). Rather than land in a silently broken keyless /flow,
    // mark the key missing → the same "authenticated but keyless" state as a
    // cold reload, which drives the blocking KeyMissingModal (§4.9) to prompt
    // a re-auth (audit 2026-07). In the normal in-flow finalize the key is
    // still in memory, so this is a no-op.
    if (!deps.hasMainKey()) deps.markKeyMissing();
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
  deps: { setAuth: SetAuth; markKeyMissing: MarkKeyMissing; hasMainKey: () => boolean },
): Promise<
  | { finalized: true }
  | { finalized: false; missing: ReadonlyArray<'totp' | 'passkey' | 'password'> }
> {
  const { startAuthentication } = await import('@simplewebauthn/browser');
  const startRes = await apiMfaPasskeyStart({});
  // Wire-frontier casts (audit 2026-06, ex-`as any`) : the server
  // ships the options as a loose JSON record, the lib wants its
  // precise JSON type — and symmetrically for the assertion. Named
  // targets so the compiler still checks everything downstream.
  const assertion = await startAuthentication({
    optionsJSON:
      startRes.requestOptions as unknown as PublicKeyCredentialRequestOptionsJSON,
  });
  const finishRes = await apiMfaPasskeyFinish({
    assertionResponse: assertion as unknown as Record<string, unknown>,
  });
  if (finishRes.finalized) {
    const me = await apiMe();
    if (!me) {
      throw new Error('mfa-passkey verify finalized but /auth/me returned null');
    }
    deps.setAuth(me);
    // Same post-reload keyless guard as verifyMfaTotp : the MFA passkey finish
    // ships no wrap blobs, so nothing re-derived the main key on this path. If
    // it's absent (page was reloaded mid-MFA), mark it missing so the
    // KeyMissingModal (§4.9) prompts a re-auth instead of a broken keyless
    // /flow (audit 2026-07). No-op when the key is still in memory.
    if (!deps.hasMainKey()) deps.markKeyMissing();
    return { finalized: true };
  }
  return { finalized: false, missing: finishRes.missing };
}

/**
 * Verify the password-as-second-factor on a `mfa_pending` session
 * (mode `maximum` entered passkey-first, whose remaining factors are
 * password + totp). Runs the OPAQUE handshake against
 * `/auth/mfa/password/{start,finish}`.
 *
 * On finalize this is also where the main key is (re)derived from the
 * password's `exportKey`: when the passkey used to enter was non-PRF,
 * nothing unwrapped the key at the passkey step (it was marked
 * missing), so the password step is the only place that can. When a
 * PRF passkey already set it, re-deriving yields the same key —
 * harmless. Same unwrap path as the full-session login branch above.
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a wrong
 * password (client-side `finishLogin` returns undefined).
 */
export async function verifyMfaPassword(
  deps: { setAuth: SetAuth; setMainKey: SetMainKey },
  password: string,
): Promise<
  | { finalized: true }
  | { finalized: false; missing: ReadonlyArray<'totp' | 'passkey' | 'password'> }
> {
  await opaqueReady;

  const { clientLoginState, startLoginRequest } = clientLoginStart(password);
  const startRes = await apiMfaPasswordStart({ startLoginRequest });
  const finished = clientLoginFinish({
    password,
    clientLoginState,
    loginResponse: startRes.loginResponse,
  });
  if (!finished) {
    throw { status: 401, error: 'invalid_credentials' };
  }

  const finishRes = await apiMfaPasswordFinish({
    loginToken: startRes.loginToken,
    finishLoginRequest: finished.finishLoginRequest,
  });

  // Derive the main key from the password exportKey + the wrap blobs
  // the response inlines — UNCONDITIONALLY, whether or not this step
  // finalized the session. For a non-PRF passkey entry nothing
  // unwrapped the key at the passkey step, and the password step isn't
  // guaranteed to be the last factor; deriving here every time keeps
  // the user from landing on /flow keyless whatever the factor order.
  // When a PRF passkey already set the key this re-derives the same one
  // (harmless). The blobs ride the response because /auth/me/crypto
  // refuses pending sessions. AAD binds to the user id (`finishRes.userId`),
  // matching the wrap at registration — same as the full-login branch.
  const kekBytes = await unwrapKekUnderFactor(
    {
      wrappedKek: finishRes.wrappedKekPassword as unknown as Base64,
      wrappedKekIv: finishRes.wrappedKekPasswordIv as unknown as Base64,
    },
    finished.exportKey,
    buildKekAAD(finishRes.userId, 'password'),
  );
  let rawBytes: Uint8Array;
  try {
    rawBytes = await unwrapMainKeyUnderKek(
      {
        wrappedMainKey: finishRes.wrappedMainKey as unknown as Base64,
        wrappedMainKeyIv: finishRes.wrappedMainKeyIv as unknown as Base64,
      },
      kekBytes,
      buildMainKeyAAD(finishRes.userId),
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

  if (!finishRes.finalized) {
    return { finalized: false, missing: finishRes.missing };
  }

  // Finalized → the session is now `full`; hydrate the user shape so
  // the auth slice flips to authenticated.
  const me = await apiMe();
  if (!me) {
    throw new Error('mfa-password verify finalized but /auth/me returned null');
  }
  deps.setAuth(me);
  return { finalized: true };
}
