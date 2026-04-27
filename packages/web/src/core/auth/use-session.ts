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
  apiMfaBypassActive,
  apiMfaBypassCancel,
  apiMfaBypassRequest,
  apiMfaPasskeyFinish,
  apiMfaPasskeyStart,
  apiMfaTotpVerify,
  apiPasskeyRemove,
  apiPasskeyRename,
  apiRecoverKekFinish,
  apiRecoverKekStart,
  apiRecoveryCodeUpsert,
  apiRegisterStart,
  apiRegisterFinish,
  apiSecurityModeChange,
  apiTotpDisable,
  apiTotpEnrollStart,
  apiTotpEnrollVerify,
  apiTotpRegenerateBackupCodes,
} from '../api/client.ts';
import type { SecurityMode } from '@nodea/shared';
import type { TotpEnrollStartResponse } from '@nodea/shared';
import {
  enrollPasskey,
  loginWithPasskey,
  type EnrollPasskeyResult,
} from './passkey-flow.ts';
import {
  unwrapKekUnderPrf,
} from '../crypto/passkey-prf.ts';
import { bytesToBase64Url, randomBytes } from '../crypto/base64.ts';
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
  generateRecoveryMnemonic,
  recoveryMnemonicToEntropy,
} from '../crypto/bip39.ts';
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

export interface SessionRecoveryCodeResult {
  /** 12-word BIP39 mnemonic — display ONCE to the user, never
   *  persisted client-side. The caller is expected to show it +
   *  collect an "I've noted it" acknowledgement before navigating
   *  away. */
  mnemonic: string;
  /** True when this call replaced an existing recovery code. False
   *  for first-time setup. Drives the post-flow message
   *  ("nouveau" vs "remplacé"). */
  regenerated: boolean;
}

export interface SessionRecoverInput {
  email: string;
  /** 12 BIP39 words typed by the user. Whitespace is normalised
   *  upstream — empty / wrong-length / bad-checksum surfaces as
   *  the typed `Error('invalid_recovery_code')`. */
  mnemonic: string;
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

  /**
   * Drive an OPAQUE login. Returns a discriminated result so the
   * caller can branch on stepped-MFA:
   *
   *   - `{ needsMfa: false }` — session is `full`, the main key is
   *     unwrapped + stored, the user shape is hydrated. Caller
   *     navigates to `/flow/home`.
   *   - `{ needsMfa: true, factorsNeeded }` — session is `mfa_pending`.
   *     The main key IS already unwrapped client-side (the wrap
   *     blobs ride along the /finish response), so subsequent data
   *     access works as soon as the session is promoted by
   *     `/auth/mfa/totp/verify`. Caller navigates to `/login/mfa`.
   *
   * Throws `{ status: 401, error: 'invalid_credentials' }` on a
   * wrong password (client-side `finishLogin` returns undefined).
   */
  async function login(
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
        setMainKey(material);
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
    return { needsMfa: false };
  }

  /**
   * Verify a TOTP code (or backup code) against the current
   * `mfa_pending` session. On finalize, hydrate `/auth/me` so the
   * auth slice flips to authenticated.
   *
   * Returns `{ finalized: true }` when the session is now `full` —
   * the caller navigates to `/flow/home`. Returns
   * `{ finalized: false, missing }` when more factors are needed
   * (e.g. mode `maximum` may still need passkey).
   */
  async function verifyMfaTotp(
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
      setAuth(me);
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
  async function verifyMfaPasskey(): Promise<
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
      setAuth(me);
      return { finalized: true };
    }
    return { finalized: false, missing: finishRes.missing };
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

  /* ============================================================================
   * Recovery code KEK — setup / regenerate (Settings)
   * ========================================================================== */

  /**
   * First-time setup OR rotate the user's BIP39 recovery code.
   * Same flow either way:
   *
   *   1. Re-derive `currentExportKey` via OPAQUE login start (so we
   *      can unwrap the user's KEK locally without trusting the
   *      session for a privileged op).
   *   2. Unwrap KEK using `currentExportKey` + the existing
   *      `wrappedKekPassword`.
   *   3. Generate a fresh BIP39 mnemonic + entropy.
   *   4. Wrap KEK under `HKDF(entropy, "nodea:wrap-kek")` →
   *      `wrappedKekRecovery`.
   *   5. Compute `SHA-256(entropy)` → `recoveryCodeHash`.
   *   6. POST `/auth/security/recovery-code` with the OPAQUE proof
   *      (always required) + the new wrap blobs + hash.
   *   7. Refresh `/me` so the sidebar tip + `recoveryCodeSet` flag
   *      flip to true; return the mnemonic for one-shot display.
   *
   * Throws `{ status: 401, error: 'invalid_credentials' }` on a
   * wrong currentPassword (client-side `finishLogin` returns
   * undefined). The caller surfaces a friendly UI message.
   */
  async function setupRecoveryCode(
    currentPassword: string,
  ): Promise<SessionRecoveryCodeResult> {
    if (!user) throw new Error('setupRecoveryCode: no authenticated user');
    if (
      user.wrappedKekPassword === null ||
      user.wrappedKekPasswordIv === null
    ) {
      throw new Error(
        'setupRecoveryCode: user row is missing the OPAQUE wrap blobs',
      );
    }
    await opaqueReady;

    // Step 1+2: OPAQUE login round-trip → exportKey → unwrap KEK.
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
      throw {
        status: 401,
        error: 'invalid_credentials',
      };
    }

    const kekBytes = await unwrapKekUnderFactor(
      {
        wrappedKek: user.wrappedKekPassword as unknown as Base64,
        wrappedKekIv: user.wrappedKekPasswordIv as unknown as Base64,
      },
      proofFinished.exportKey,
      buildKekAAD(user.id, 'password'),
    );

    // Step 3-5: fresh BIP39, wrap KEK under it, compute hash.
    const { mnemonic, entropy } = generateRecoveryMnemonic();
    try {
      const recoveryWrap = await wrapKekUnderFactor(
        kekBytes,
        // factor-wrap accepts string (base64url) OR Uint8Array;
        // BIP39 entropy comes as Uint8Array directly.
        entropy,
        buildKekAAD(user.id, 'recovery'),
      );

      const { sha256Hex } = await import('../crypto/bip39.ts');
      const recoveryCodeHash = await sha256Hex(entropy);

      // Step 6: POST with the OPAQUE proof (always required).
      const result = await apiRecoveryCodeUpsert({
        wrappedKekRecovery: recoveryWrap.wrappedKek,
        wrappedKekRecoveryIv: recoveryWrap.wrappedKekIv,
        recoveryCodeHash,
        proofLoginToken: proofStart.loginToken,
        proofFinishLoginRequest: proofFinished.finishLoginRequest,
      });

      // Step 7: refresh /me so `recoveryCodeSet` flips.
      const me = await apiMe();
      if (me) setAuth(me);

      return { mnemonic, regenerated: result.regenerated };
    } finally {
      entropy.fill(0);
      kekBytes.fill(0);
    }
  }

  /* ============================================================================
   * Recovery code KEK — recover flow (anonymous, /recover page)
   * ========================================================================== */

  /**
   * Drive the full recover-with-code flow: typed mnemonic + new
   * password → unwrap KEK locally → fresh OPAQUE registration on
   * the new password → re-wrap KEK under the new `exportKey` AND
   * under a freshly-generated BIP39 entropy → ship to /finish.
   * Server replaces every credential blob in a transaction and
   * mints a fresh session cookie.
   *
   * The OLD recovery code is invalidated (its `wrappedKekRecovery`
   * blob is gone after /finish). The returned mnemonic is the NEW
   * code the user must save; show it once and prompt for the
   * "j'ai noté" acknowledgement before navigating away.
   *
   * Throws on:
   *   - Bad mnemonic shape (wrong word count, unknown word, bad
   *     checksum) → `Error('invalid_recovery_code')`.
   *   - Wrong code (server `recovery_code_hash` mismatch) →
   *     `{ status: 401, error: 'invalid_credentials' }` from the
   *     /finish response.
   *   - Anti-enum on unknown email → also surfaces as 401 at
   *     /finish time.
   */
  async function recoverWithCode(
    input: SessionRecoverInput,
  ): Promise<SessionRecoveryCodeResult> {
    await opaqueReady;

    const entropy = recoveryMnemonicToEntropy(input.mnemonic);
    if (!entropy) throw new Error('invalid_recovery_code');

    try {
      // Step 1: OPAQUE registration start with the new password.
      const reg = clientRegisterStart(input.newPassword);

      // Step 2: /recover-kek/start — we hand over email +
      // registrationRequest, the server hands back the user's
      // wrappedKekRecovery + a registrationResponse + a session id
      // + the userId (for AAD).
      const start = await apiRecoverKekStart({
        email: input.email,
        registrationRequest: reg.registrationRequest,
      });

      // Step 3: try to unwrap the KEK locally with the typed
      // entropy. AAD = nodea:v1\x1f<userId>\x1frecovery. For
      // unknown-email cases the server returned random blobs that
      // will fail the auth-tag check; same shape as a real wrong-
      // code attempt. We surface the failure as a generic
      // "invalid_recovery_code" so the UI doesn't leak which leg
      // it failed on.
      let kekBytes: Uint8Array;
      try {
        kekBytes = await unwrapKekUnderFactor(
          {
            wrappedKek: start.wrappedKekRecovery as unknown as Base64,
            wrappedKekIv: start.wrappedKekRecoveryIv as unknown as Base64,
          },
          entropy,
          buildKekAAD(start.userId, 'recovery'),
        );
      } catch {
        throw new Error('invalid_recovery_code');
      }

      try {
        // Step 4: complete OPAQUE registration locally with the new
        // password to get the new envelope + new exportKey.
        const newReg = clientRegisterFinish({
          password: input.newPassword,
          clientRegistrationState: reg.clientRegistrationState,
          registrationResponse: start.registrationResponse,
        });

        // Step 5: re-wrap KEK under the new exportKey.
        const newKekWrap = await wrapKekUnderFactor(
          kekBytes,
          newReg.exportKey,
          buildKekAAD(start.userId, 'password'),
        );

        // Step 6: generate a NEW BIP39 mnemonic — the old code is
        // invalidated as soon as /finish runs, so we must be ready
        // to display the replacement.
        const { mnemonic: newMnemonic, entropy: newEntropy } =
          generateRecoveryMnemonic();
        try {
          const newRecoveryWrap = await wrapKekUnderFactor(
            kekBytes,
            newEntropy,
            buildKekAAD(start.userId, 'recovery'),
          );
          const { sha256Hex } = await import('../crypto/bip39.ts');
          const newHash = await sha256Hex(newEntropy);
          const oldHash = await sha256Hex(entropy);

          await apiRecoverKekFinish({
            recoverSessionId: start.recoverSessionId,
            recoveryCodeHash: oldHash,
            registrationRecord: newReg.registrationRecord,
            wrappedKekPassword: newKekWrap.wrappedKek,
            wrappedKekPasswordIv: newKekWrap.wrappedKekIv,
            wrappedKekRecoveryNew: newRecoveryWrap.wrappedKek,
            wrappedKekRecoveryNewIv: newRecoveryWrap.wrappedKekIv,
            recoveryCodeHashNew: newHash,
          });

          // Server has minted a fresh session cookie + replaced
          // every credential blob. Hydrate `/me` so the rest of
          // the app picks up the new state.
          const me = await apiMe();
          if (me) setAuth(me);

          // Derive main-key material from the in-memory KEK we
          // just unwrapped (the wrapped_main_key blob didn't
          // change). The user lands on the app fully signed in.
          if (
            me?.wrappedMainKey !== undefined &&
            me?.wrappedMainKey !== null &&
            me?.wrappedMainKeyIv !== undefined &&
            me?.wrappedMainKeyIv !== null
          ) {
            const rawMainKey = await unwrapMainKeyUnderKek(
              {
                wrappedMainKey: me.wrappedMainKey as unknown as Base64,
                wrappedMainKeyIv: me.wrappedMainKeyIv as unknown as Base64,
              },
              kekBytes,
              buildMainKeyAAD(me.id),
            );
            try {
              const material = await deriveMainKeys(rawMainKey);
              setMainKey(material);
            } finally {
              rawMainKey.fill(0);
            }
          }

          return { mnemonic: newMnemonic, regenerated: true };
        } finally {
          newEntropy.fill(0);
        }
      } finally {
        kekBytes.fill(0);
      }
    } finally {
      entropy.fill(0);
    }
  }

  /* ============================================================================
   * Passkeys (Auth-Roadmap Phase 4)
   * ========================================================================== */

  /**
   * Enroll a new passkey. Drives the OPAQUE password proof, the
   * WebAuthn registration ceremony, and the KEK wrap under PRF if
   * the authenticator surfaces one. Refreshes `/me` so the
   * `passkeysCount` flips and the sidebar tip disappears.
   *
   * Throws `{ status: 401, error: 'invalid_credentials' }` on a
   * wrong currentPassword, and re-throws WebAuthn errors as-is so
   * the caller can branch on the user-cancelled / not-allowed shape.
   */
  async function enrollPasskeyFlow(
    currentPassword: string,
    label: string,
  ): Promise<EnrollPasskeyResult> {
    if (!user) throw new Error('enrollPasskey: no authenticated user');

    const result = await enrollPasskey({
      user: {
        id: user.id,
        email: user.email,
        wrappedKekPassword: user.wrappedKekPassword,
        wrappedKekPasswordIv: user.wrappedKekPasswordIv,
      },
      currentPassword,
      label,
    });

    // Refresh /me so passkeysCount + passkeysPrfCount flip in the
    // store — the sidebar tip + Settings UI react automatically.
    const me = await apiMe();
    if (me) setAuth(me);

    return result;
  }

  /**
   * Rename an enrolled passkey. Requires fresh password proof per
   * the matrice de re-auth (§6).
   */
  async function renamePasskey(
    id: string,
    currentPassword: string,
    label: string,
  ): Promise<void> {
    if (!user) throw new Error('renamePasskey: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    await apiPasskeyRename(id, {
      label,
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
  }

  /**
   * Remove an enrolled passkey. Requires fresh password proof per
   * the matrice. Server handles the §6.1 downgrade auto when the
   * deletion takes the last PRF-capable credential under
   * `security_mode = 'maximum'`.
   */
  async function removePasskey(
    id: string,
    currentPassword: string,
  ): Promise<void> {
    if (!user) throw new Error('removePasskey: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    await apiPasskeyRemove(id, {
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
    // Refresh /me so passkeysCount drops accordingly.
    const me = await apiMe();
    if (me) setAuth(me);
  }

  /**
   * Drive a full passkey-first login (Auth-Spec §7.3).
   *
   * Three outcomes possible:
   *   - **Full unlock** : the credential is PRF-capable AND the
   *     authenticator surfaced the PRF output. We unwrap the KEK,
   *     unwrap the main key, derive sub-keys, and the user lands
   *     fully signed in.
   *   - **Login-only**  : the credential is registered but not
   *     PRF-capable, OR the authenticator didn't surface the PRF
   *     output. The session cookie is set (the user IS authed) but
   *     the main key is unreachable from this credential alone — the
   *     UI must prompt for the password to finish unlocking.
   *
   * Throws on a missing assertion (user cancelled, no credential
   * matched, server rejected) — same as the password flow.
   */
  async function passkeyLogin(input: { email?: string }): Promise<{
    /** False when the credential is non-PRF or PRF deferred — the
     *  caller should prompt for the password and call `login(...)`
     *  to finish the unwrap. The session cookie is already set by
     *  this point, so a refresh would still drop the user on a
     *  signed-in shell. */
    fullyUnlocked: boolean;
    /** Phase 5C — true when the server emitted `mfa_pending` because
     *  the user's `security_mode` requires factors beyond passkey.
     *  Caller navigates to `/login/mfa` to drive the next step. */
    needsMfa: boolean;
    factorsNeeded: ReadonlyArray<'totp' | 'passkey' | 'password'>;
  }> {
    const result = await loginWithPasskey(
      input.email !== undefined ? { email: input.email } : {},
    );

    // Stepped MFA branch — `/auth/me` refuses pending sessions, so
    // we skip the user-shape hydration and use the wrap blobs from
    // the /finish response directly to derive the main key. The
    // auth slice stays null until MFA finalize promotes the session
    // and `verifyMfaTotp` calls /me.
    if (result.needsMfa) {
      // Login-only credential + needsMfa is rare but possible (mode
      // `maximum` user enrolled a non-PRF passkey). Without PRF we
      // can't unwrap the KEK from passkey alone; the caller will
      // chain a password login as the second factor.
      if (
        !result.prfSupported ||
        result.prfOutput === null ||
        result.wrappedKek === null ||
        result.wrappedKekIv === null
      ) {
        markKeyMissing();
        return {
          fullyUnlocked: false,
          needsMfa: true,
          factorsNeeded: result.factorsNeeded,
        };
      }
      const prfOutput = result.prfOutput;
      try {
        const kekBytes = await unwrapKekUnderPrf(
          {
            wrappedKek: result.wrappedKek as unknown as Base64,
            wrappedKekIv: result.wrappedKekIv as unknown as Base64,
          },
          prfOutput,
          result.userId,
          result.credentialId,
        );
        let rawMainKey: Uint8Array;
        try {
          rawMainKey = await unwrapMainKeyUnderKek(
            {
              wrappedMainKey: result.wrappedMainKey as unknown as Base64,
              wrappedMainKeyIv: result.wrappedMainKeyIv as unknown as Base64,
            },
            kekBytes,
            buildMainKeyAAD(result.userId),
          );
        } finally {
          kekBytes.fill(0);
        }
        try {
          const material = await deriveMainKeys(rawMainKey);
          setMainKey(material);
        } finally {
          rawMainKey.fill(0);
        }
      } finally {
        prfOutput.fill(0);
      }
      return {
        fullyUnlocked: true,
        needsMfa: true,
        factorsNeeded: result.factorsNeeded,
      };
    }

    // Original full-session path — pre-Phase-5C behaviour.
    const me = await apiMe();
    if (!me) {
      throw new Error('passkey-login: server accepted assertion but /me returned null');
    }
    setAuth(me);
    if (
      me.wrappedMainKey === null ||
      me.wrappedMainKeyIv === null ||
      me.wrappedKekPassword === null ||
      me.wrappedKekPasswordIv === null
    ) {
      throw new Error('passkey-login: user row missing OPAQUE wrap blobs');
    }

    // Login-only path: no PRF output → the KEK can't be unwrapped
    // from this credential. The UI prompts for the password next.
    if (
      !result.prfSupported ||
      result.prfOutput === null ||
      result.wrappedKek === null ||
      result.wrappedKekIv === null
    ) {
      // We DON'T mark key missing here — the caller may chain a
      // password login immediately. If they don't, the
      // ProtectedRoute layer will catch the missing main key and
      // surface the prompt. Same UX as a cold reload.
      markKeyMissing();
      return { fullyUnlocked: false, needsMfa: false, factorsNeeded: [] };
    }

    const prfOutput = result.prfOutput;
    try {
      const kekBytes = await unwrapKekUnderPrf(
        {
          wrappedKek: result.wrappedKek as unknown as Base64,
          wrappedKekIv: result.wrappedKekIv as unknown as Base64,
        },
        prfOutput,
        result.userId,
        result.credentialId,
      );
      let rawMainKey: Uint8Array;
      try {
        rawMainKey = await unwrapMainKeyUnderKek(
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
        const material = await deriveMainKeys(rawMainKey);
        setMainKey(material);
      } finally {
        rawMainKey.fill(0);
      }
    } finally {
      prfOutput.fill(0);
    }

    return { fullyUnlocked: true, needsMfa: false, factorsNeeded: [] };
  }

  /* ============================================================================
   * TOTP (Auth-Roadmap Phase 5B)
   * ========================================================================== */

  /**
   * Drive a TOTP enrollment start: re-prove the password and ask the
   * server for a fresh secret + 10 backup codes. Returns the
   * `secretBase32`, `otpauthUri` (for QR rendering), and the codes —
   * all displayed once. The user must scan the QR / type the code,
   * then call `verifyTotpEnrollment` to flip the row from pending
   * to enabled.
   *
   * Throws `{ status: 401, error: 'invalid_credentials' }` on a wrong
   * password — same shape the rest of the hook surfaces.
   */
  async function startTotpEnrollment(
    currentPassword: string,
  ): Promise<TotpEnrollStartResponse> {
    if (!user) throw new Error('startTotpEnrollment: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    return apiTotpEnrollStart({
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
  }

  /**
   * Confirm an enrollment with a TOTP code + the backup-codes ack.
   * On success the server flips `enabled_at`; we refresh `/me` so
   * the sidebar tip + Settings UI react.
   */
  async function verifyTotpEnrollment(code: string): Promise<void> {
    if (!user) throw new Error('verifyTotpEnrollment: no authenticated user');
    await apiTotpEnrollVerify({ code, backupCodesAcknowledged: true });
    const me = await apiMe();
    if (me) setAuth(me);
  }

  /**
   * Disable TOTP. Requires fresh password proof (matrice §6). Server
   * applies §6.1 downgrade auto if `security_mode` was
   * `always_totp` / `maximum`. Refreshes `/me` so the UI reflects
   * the new mode + flag.
   */
  async function disableTotp(currentPassword: string): Promise<void> {
    if (!user) throw new Error('disableTotp: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    await apiTotpDisable({
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
    const me = await apiMe();
    if (me) setAuth(me);
  }

  /**
   * Regenerate the 10 TOTP backup codes. Requires fresh password
   * proof. Refuses 400 if TOTP isn't enabled (would be regenerating
   * into a dead pool). Returns the fresh codes for one-shot display;
   * old codes are invalidated atomically.
   */
  async function regenerateTotpBackupCodes(
    currentPassword: string,
  ): Promise<string[]> {
    if (!user) throw new Error('regenerateTotpBackupCodes: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    const res = await apiTotpRegenerateBackupCodes({
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
    // Refresh /me — the count should still be 10, but the field
    // is non-stale after this call too.
    const me = await apiMe();
    if (me) setAuth(me);
    return res.backupCodes;
  }

  /**
   * Request a bypass for a single MFA factor from the
   * `/login/mfa` blocked screen (Auth-Roadmap Phase 6, Auth-Spec
   * §7.8). Returns the earliest possible apply timestamp so the
   * UI can render "tu pourras te connecter sans <factor> à partir
   * du <date>".
   *
   * Throws ApiError shapes:
   *   - 409 `multi_factor_loss` — the §6.2 wall fires (mode max +
   *     two factors lost). Caller routes to the destructive reset.
   *   - 409 `bypass_already_active` — a request is already in
   *     flight; nothing to do.
   *   - 400 `factor_not_required` — degenerate state (mode demoted
   *     mid-session). Caller refreshes /me and recomputes.
   */
  async function requestMfaBypass(
    factor: 'totp' | 'passkey',
  ): Promise<{ earliestApplyAt: string }> {
    return apiMfaBypassRequest({ factor });
  }

  /**
   * Read the active bypass for the current full-session user.
   * Used by Settings → Sécurité to surface a "you have a pending
   * bypass" row + cancel button. `null` = no active bypass.
   */
  async function getActiveMfaBypass(): ReturnType<typeof apiMfaBypassActive> {
    return apiMfaBypassActive();
  }

  /**
   * Cancel the active bypass from a full session (Settings button).
   * Throws if there's no active bypass — caller should hide the
   * button when `getActiveMfaBypass` returned `{ active: null }`.
   */
  async function cancelMfaBypass(): Promise<void> {
    await apiMfaBypassCancel();
  }

  /**
   * Change the user's `security_mode` (Auth-Roadmap Phase 5D).
   * Requires fresh password proof (matrice §6). Server validates
   * §6.1 prerequisites — caller catches `totp_required` /
   * `passkey_required` 400 errors to surface the right CTA in the
   * UI ("active TOTP first" / "enroll a passkey first").
   */
  async function changeSecurityMode(
    mode: SecurityMode,
    currentPassword: string,
  ): Promise<void> {
    if (!user) throw new Error('changeSecurityMode: no authenticated user');
    const proof = await issuePasswordProof(user.email, currentPassword);
    await apiSecurityModeChange({
      mode,
      proofLoginToken: proof.loginToken,
      proofFinishLoginRequest: proof.finishLoginRequest,
    });
    // Refresh /me so the store reflects the new mode + the UI gates
    // recompute (e.g. the disable-TOTP button gains the "will
    // downgrade to password_or_passkey" warning).
    const me = await apiMe();
    if (me) setAuth(me);
  }

  return {
    status,
    user,
    login,
    submitRegistration,
    logout,
    changePassword,
    setupRecoveryCode,
    recoverWithCode,
    enrollPasskey: enrollPasskeyFlow,
    renamePasskey,
    removePasskey,
    loginWithPasskey: passkeyLogin,
    startTotpEnrollment,
    verifyTotpEnrollment,
    disableTotp,
    regenerateTotpBackupCodes,
    verifyMfaTotp,
    verifyMfaPasskey,
    changeSecurityMode,
    requestMfaBypass,
    getActiveMfaBypass,
    cancelMfaBypass,
  };
}

/* ============================================================================
 * Shared helpers (module scope)
 * ========================================================================== */

/**
 * Run a one-shot OPAQUE login start/finish locally to produce a
 * password proof for re-auth-fresh routes. Returns the live token
 * pair the caller must POST within 5 minutes (the server's pending
 * state TTL).
 *
 * Throws `{ status: 401, error: 'invalid_credentials' }` on a wrong
 * password — same shape the rest of the hook surfaces.
 */
async function issuePasswordProof(
  email: string,
  password: string,
): Promise<{ loginToken: string; finishLoginRequest: string }> {
  await opaqueReady;
  const proofClient = clientLoginStart(password);
  const proofStart = await apiLoginStart({
    email,
    startLoginRequest: proofClient.startLoginRequest,
  });
  const proofFinished = clientLoginFinish({
    password,
    clientLoginState: proofClient.clientLoginState,
    loginResponse: proofStart.loginResponse,
  });
  if (!proofFinished) {
    throw { status: 401, error: 'invalid_credentials' };
  }
  return {
    loginToken: proofStart.loginToken,
    finishLoginRequest: proofFinished.finishLoginRequest,
  };
}

// Stub-keep: `bytesToBase64Url` is imported for an upcoming wire
// format the recovery flow may need; we don't use it yet but I'd
// rather not drop the import and re-add it.
void bytesToBase64Url;
