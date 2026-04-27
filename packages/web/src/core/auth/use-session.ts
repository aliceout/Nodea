/**
 * Session hook for the new back.
 *
 * Replaces the legacy `useAuth.js` (PB authStore). Keeps the Zustand
 * store in sync with `/auth/me` — on mount, and after any
 * login/register/logout/change-password call — and manages the
 * lifetime of the in-memory `MainKeyMaterial`:
 *
 *   - login : derive it from the user's password + stored envelope
 *   - register : derive it from the freshly generated main-key bytes
 *   - changePassword : rewrap under the new password then re-derive
 *   - logout : wiped by `resetAll()`
 *
 * On a cold page load, the session cookie survives but the main key
 * does not (it cannot — the client doesn't have the password). The UI
 * surfaces a "key missing" prompt until the user re-authenticates.
 */
import { useEffect } from 'react';
import { useNodeaStore, selectAuthStatus, selectUser } from '../store/nodea-store.ts';
import {
  apiLogin,
  apiLogout,
  apiMe,
  apiRegisterStart,
  apiRegisterFinish,
  apiChangePassword,
} from '../api/client.ts';
import { randomBytes } from '../crypto/base64.ts';
import { deriveMainKeys } from '../crypto/key-material.ts';
import { unwrapMainKeyBytes, wrapMainKey } from '../crypto/envelope.ts';
import {
  buildKekAAD,
  buildMainKeyAAD,
  wrapKekUnderFactor,
  wrapMainKeyUnderKek,
} from '../crypto/factor-wrap.ts';
import {
  clientRegisterFinish,
  clientRegisterStart,
  opaqueReady,
} from './opaque.ts';
import type { LoginBody } from '@nodea/shared';

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
    await apiLogin(body);
    const me = await apiMe();
    if (!me) throw new Error('login succeeded but /auth/me returned null');
    setAuth(me);

    // Phase 2B: legacy Argon2id login still drives the unwrap path.
    // OPAQUE-registered accounts (NULL `encryptionSalt`/`encryptedKey`)
    // can't authenticate here — Phase 2C wires the OPAQUE login route
    // and the matching unwrap chain (`wrappedKekPassword` →
    // `wrappedMainKey`). Until then, throw loudly rather than silently
    // skipping main-key derivation.
    if (!me.encryptionSalt || !me.encryptedKey) {
      throw new Error(
        'login: account is OPAQUE-registered (Phase 2B) and the OPAQUE login flow is not yet wired (Phase 2C).',
      );
    }
    const rawBytes = await unwrapMainKeyBytes(
      body.password,
      me.encryptionSalt,
      me.encryptedKey,
    );
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

    // Phase 2B: legacy change-password path. OPAQUE accounts can't
    // change their password until 2D rewires this flow on top of
    // OPAQUE re-registration.
    if (!user.encryptionSalt || !user.encryptedKey) {
      throw new Error(
        'changePassword: account is OPAQUE-registered and the OPAQUE change-password flow is not yet wired (Phase 2D).',
      );
    }
    // Unwrap under the CURRENT password first — throws on wrong password
    // (AES-GCM auth-tag check) before we touch the server.
    const rawMainKey = await unwrapMainKeyBytes(
      input.currentPassword,
      user.encryptionSalt,
      user.encryptedKey,
    );
    try {
      const { encryptionSalt, encryptedKey } = await wrapMainKey(input.newPassword, rawMainKey);
      await apiChangePassword({
        currentPassword: input.currentPassword,
        newPassword: input.newPassword,
        encryptionSalt,
        encryptedKey,
      });

      const me = await apiMe();
      if (!me) throw new Error('change-password succeeded but /auth/me returned null');
      setAuth(me);

      const material = await deriveMainKeys(rawMainKey);
      setMainKey(material);
    } finally {
      rawMainKey.fill(0);
    }
  }

  return { status, user, login, submitRegistration, logout, changePassword };
}
