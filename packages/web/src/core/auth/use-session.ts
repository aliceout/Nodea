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
  apiRegisterSubmit,
  apiChangePassword,
} from '../api/client.ts';
import { randomBytes } from '../crypto/base64.ts';
import { deriveMainKeys } from '../crypto/key-material.ts';
import { unwrapMainKeyBytes, wrapMainKey } from '../crypto/envelope.ts';
import type { LoginBody } from '@nodea/shared';

export interface SessionRegisterInput {
  email: string;
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

    // Derive the main key from the password + the server's envelope.
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
   * Submit a new registration (Auth-Roadmap Phase 1, post-rework v2).
   *
   * Generates a fresh main key client-side, wraps it under the
   * password-derived KEK, and ships the envelope alongside the
   * email + password (+ invite token, when arriving from an invite
   * link). Two server-side paths:
   *
   *   - With `inviteToken`  → strict email match, account activated
   *                            immediately on submit.
   *   - Without              → open-registration path; account stays
   *                            inactive until the activation email
   *                            link is clicked.
   *
   * No session cookie is emitted in either path. Per UX decision the
   * user re-types their password on /login?activated=1 once the
   * account is ready — we throw away the main-key bytes here on
   * purpose to avoid keeping them in memory across the redirect.
   */
  async function submitRegistration(
    input: SessionRegisterInput,
  ): Promise<SessionRegisterResult> {
    const rawMainKey = randomBytes(32);
    try {
      const { encryptionSalt, encryptedKey } = await wrapMainKey(input.password, rawMainKey);
      const body: Parameters<typeof apiRegisterSubmit>[0] = {
        email: input.email,
        password: input.password,
        encryptionSalt,
        encryptedKey,
      };
      if (input.inviteToken) body.inviteToken = input.inviteToken;
      const res = await apiRegisterSubmit(body);
      const result: SessionRegisterResult = { activated: res.activated };
      if (res.email !== undefined) result.email = res.email;
      return result;
    } finally {
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
