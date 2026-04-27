/**
 * Session hook for the new back.
 *
 * Replaces the legacy `useAuth.js` (PB authStore). Keeps the Zustand
 * store in sync with `/auth/me` — on mount, and after any
 * login/register/logout/change-password call — and manages the
 * lifetime of the in-memory `MainKeyMaterial`:
 *
 *   - login            : OPAQUE login → exportKey → unwrap KEK
 *                        (`wrapped_kek_password`) → unwrap main key
 *                        (`wrapped_main_key`) → derive sub-keys.
 *   - submitRegistration: fresh OPAQUE register → fresh KEK + main
 *                        key, both wrapped. Server stores the
 *                        envelope, client throws away the bytes
 *                        (re-login derives them again).
 *   - changePassword   : OPAQUE proof of current password → unwrap
 *                        KEK → fresh OPAQUE register on new password
 *                        → re-wrap SAME KEK under new exportKey →
 *                        force-logout. Main key wrap untouched.
 *   - logout           : wiped by `resetAll()`.
 *
 * On a cold page load, the session cookie survives but the main key
 * does not (it cannot — the client doesn't have the password). The UI
 * surfaces a "key missing" prompt until the user re-authenticates.
 */
import { useEffect } from 'react';
import { useNodeaStore, selectAuthStatus, selectUser } from '../store/nodea-store.ts';
import {
  apiChangePasswordFinish,
  apiChangePasswordStart,
  apiLoginStart,
  apiLoginFinish,
  apiLogout,
  apiMe,
  apiRegisterStart,
  apiRegisterFinish,
} from '../api/client.ts';
import { randomBytes } from '../crypto/base64.ts';
import { deriveMainKeys } from '../crypto/key-material.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  unwrapKekUnderFactor,
  unwrapMainKeyUnderKek,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '../crypto/factor-wrap.ts';
import {
  clientLoginFinish,
  clientLoginStart,
  clientRegisterFinish,
  clientRegisterStart,
  opaqueReady,
} from './opaque.ts';
import type { Base64, LoginBody } from '@nodea/shared';

export interface SessionRegisterInput {
  email: string;
  /** Public display name — required since the username field landed
   *  in Phase 1. Validated server-side against `UsernameField` (2-32
   *  chars, alphanumerics + `_-.`). */
  username: string;
  password: string;
  /** Invite-token branch: pre-filled by Register from the URL when
   *  the user arrived via an invite link. Optional — when omitted the
   *  call hits the open-registration path instead (which 403s if the
   *  admin toggle is off). */
  inviteToken?: string;
}

export interface SessionRegisterResult {
  /** True when the server activated the account at submit time
   *  (invited path). False when the user must still click an
   *  activation email (open path). */
  activated: boolean;
  /** Echoed back from the server on the invited path so the UI can
   *  redirect to /login?activated=1 with the email known. */
  email?: string;
}

export interface SessionChangePasswordInput {
  currentPassword: string;
  newPassword: string;
}

/**
 * Module-level latch. Multiple components call `useSession()` across
 * the app (ProtectedRoute, Layout, Login, …); we need exactly ONE
 * hydration round-trip at app startup, not one per subscriber.
 * Without this guard, a second mount's `setAuthLoading()` would
 * race-reset the auth slice back to `loading` after an earlier one
 * settled it — ProtectedRoute would then stay stuck on its
 * null-render branch forever on a cold reload of `/flow/*`.
 */
let hydrationStarted = false;

export function useSession() {
  const status = useNodeaStore(selectAuthStatus);
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);
  const setAuthLoading = useNodeaStore((s) => s.setAuthLoading);
  const setMainKey = useNodeaStore((s) => s.setMainKey);
  const markKeyMissing = useNodeaStore((s) => s.markKeyMissing);
  const resetAll = useNodeaStore((s) => s.resetAll);

  // Initial hydration — runs ONCE per app lifetime (module-level
  // `hydrationStarted` latch). The session cookie may be valid; the
  // main key, however, isn't recoverable without the password — we
  // mark it missing so the UI can prompt.
  useEffect(() => {
    if (hydrationStarted) return;
    hydrationStarted = true;
    setAuthLoading();
    apiMe()
      .then((me) => {
        setAuth(me);
        if (me) markKeyMissing();
      })
      .catch(() => {
        setAuth(null);
      });
  }, [setAuth, setAuthLoading, markKeyMissing]);

  async function login(body: LoginBody): Promise<void> {
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

    // Server-side verification + session emission. Failures here
    // surface as 401 / 403 from the API layer; we let them bubble up.
    await apiLoginFinish({
      loginToken: startRes.loginToken,
      finishLoginRequest: finished.finishLoginRequest,
    });

    const me = await apiMe();
    if (!me) throw new Error('login succeeded but /auth/me returned null');
    setAuth(me);

    // Phase 2D dropped the legacy fallback — every authenticated
    // user has the OPAQUE blobs at this point (the seed enrolls the
    // admin via OPAQUE too). The Base64 brand check passes at
    // compile time because Zod has already validated the blobs as
    // non-empty strings via `AuthMeResponseSchema`.
    if (
      me.wrappedMainKey === null ||
      me.wrappedMainKeyIv === null ||
      me.wrappedKekPassword === null ||
      me.wrappedKekPasswordIv === null
    ) {
      throw new Error('login: user row is missing the OPAQUE wrap blobs');
    }
    const kekBytes = await unwrapKekUnderFactor(
      {
        wrappedKek: me.wrappedKekPassword as unknown as Base64,
        wrappedKekIv: me.wrappedKekPasswordIv as unknown as Base64,
      },
      finished.exportKey,
      buildKekAAD(me.id, 'password'),
    );
    let rawBytes: Uint8Array;
    try {
      rawBytes = await unwrapMainKeyUnderKek(
        {
          wrappedMainKey: me.wrappedMainKey as unknown as Base64,
          wrappedMainKeyIv: me.wrappedMainKeyIv as unknown as Base64,
        },
        kekBytes,
        buildMainKeyAAD(me.id),
      );
    } finally {
      kekBytes.fill(0);
    }

    try {
      const material = await deriveMainKeys(rawBytes);
      setMainKey(material);
    } finally {
      rawBytes.fill(0);
    }
  }

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
  async function submitRegistration(
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

  async function logout(): Promise<void> {
    try {
      await apiLogout();
    } finally {
      // Reset the hydration latch so a subsequent login on the same
      // React session re-runs the /auth/me round-trip.
      hydrationStarted = false;
      resetAll();
    }
  }

  async function changePassword(input: SessionChangePasswordInput): Promise<void> {
    if (!user) throw new Error('changePassword: no authenticated user');
    if (
      user.wrappedMainKey === null ||
      user.wrappedMainKeyIv === null ||
      user.wrappedKekPassword === null ||
      user.wrappedKekPasswordIv === null
    ) {
      throw new Error('changePassword: user row is missing the OPAQUE wrap blobs');
    }
    await opaqueReady;

    // Step 1: prove knowledge of the current password via an OPAQUE
    // login round-trip, deriving `currentExportKey` locally so we
    // can unwrap the current KEK before re-wrapping under the new
    // password's exportKey.
    const proofClient = clientLoginStart(input.currentPassword);
    const proofStart = await apiLoginStart({
      email: user.email,
      startLoginRequest: proofClient.startLoginRequest,
    });
    const proofFinished = clientLoginFinish({
      password: input.currentPassword,
      clientLoginState: proofClient.clientLoginState,
      loginResponse: proofStart.loginResponse,
    });
    if (!proofFinished) {
      throw {
        status: 401,
        error: 'invalid_credentials',
      };
    }
    const currentExportKey = proofFinished.exportKey;

    // Step 2: unwrap the current KEK using `currentExportKey`.
    const kekBytes = await unwrapKekUnderFactor(
      {
        wrappedKek: user.wrappedKekPassword as unknown as Base64,
        wrappedKekIv: user.wrappedKekPasswordIv as unknown as Base64,
      },
      currentExportKey,
      buildKekAAD(user.id, 'password'),
    );

    try {
      // Step 3: trade the proof + a fresh `registrationRequest` (for
      // the new password) against `/change-password/start` for the
      // server's `registrationResponse` + a single-use token to echo
      // at /finish.
      const newRegStart = clientRegisterStart(input.newPassword);
      const startRes = await apiChangePasswordStart({
        proofLoginToken: proofStart.loginToken,
        proofFinishLoginRequest: proofFinished.finishLoginRequest,
        registrationRequest: newRegStart.registrationRequest,
      });

      // Step 4: complete the OPAQUE registration locally with the
      // new password to get the new envelope + `newExportKey`.
      const newRegFinished = clientRegisterFinish({
        password: input.newPassword,
        clientRegistrationState: newRegStart.clientRegistrationState,
        registrationResponse: startRes.registrationResponse,
      });

      // Step 5: re-wrap the SAME KEK under the new exportKey.
      const newKekWrap = await wrapKekUnderFactor(
        kekBytes,
        newRegFinished.exportKey,
        buildKekAAD(user.id, 'password'),
      );

      // Step 6: ship everything to /change-password/finish.
      await apiChangePasswordFinish({
        changePasswordToken: startRes.changePasswordToken,
        registrationRecord: newRegFinished.registrationRecord,
        wrappedKekPassword: newKekWrap.wrappedKek,
        wrappedKekPasswordIv: newKekWrap.wrappedKekIv,
      });

      // The session cookie has been rotated by the server; refresh
      // /me + re-derive the in-memory main-key material from the
      // KEK we still have on hand (the wrapped main key didn't
      // change, so we don't need a fresh unwrap).
      const me = await apiMe();
      if (!me) throw new Error('change-password succeeded but /auth/me returned null');
      setAuth(me);

      const rawMainKey = await unwrapMainKeyUnderKek(
        {
          wrappedMainKey: user.wrappedMainKey as unknown as Base64,
          wrappedMainKeyIv: user.wrappedMainKeyIv as unknown as Base64,
        },
        kekBytes,
        buildMainKeyAAD(user.id),
      );
      try {
        const material = await deriveMainKeys(rawMainKey);
        setMainKey(material);
      } finally {
        rawMainKey.fill(0);
      }
    } finally {
      kekBytes.fill(0);
    }
  }

  return { status, user, login, submitRegistration, logout, changePassword };
}
