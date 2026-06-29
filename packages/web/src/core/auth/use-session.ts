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
 *
 * Architecture: this file is the React surface only — the actual
 * action implementations live in `session/*.ts`, one module per
 * domain (login / register / change-password / recovery-code /
 * passkeys / totp / security-mode). Each helper receives a narrow
 * `deps` object with the store mutations + `user` it actually uses,
 * which is closed over here from the Zustand selectors. Consumers
 * still see the same `useSession()` object shape they always have.
 */
import { useEffect } from 'react';

import { apiLogout, apiMe } from '../api/client.ts';
import { selectAuthStatus, selectUser, useNodeaStore } from '../store/nodea-store.ts';

import { purgeLocalDrafts } from './purge-local-drafts.ts';

import { changePassword as changePasswordAction } from './session/change-password.ts';
import {
  login as loginAction,
  verifyMfaPasskey as verifyMfaPasskeyAction,
  verifyMfaPassword as verifyMfaPasswordAction,
  verifyMfaTotp as verifyMfaTotpAction,
} from './session/login.ts';
import {
  enrollPasskeyFlow as enrollPasskeyAction,
  passkeyLogin as passkeyLoginAction,
  removePasskey as removePasskeyAction,
  renamePasskey as renamePasskeyAction,
} from './session/passkeys.ts';
import {
  recoverWithCode as recoverWithCodeAction,
  reverifyRecoveryCode as reverifyRecoveryCodeAction,
  setupRecoveryCode as setupRecoveryCodeAction,
} from './session/recovery-code.ts';
import {
  finishRegistration as finishRegistrationAction,
  prepareRegistration as prepareRegistrationAction,
} from './session/register.ts';
import {
  changeSecurityMode as changeSecurityModeAction,
  requestMfaBypass as requestMfaBypassAction,
} from './session/security-mode.ts';
import {
  disableTotp as disableTotpAction,
  regenerateTotpBackupCodes as regenerateTotpBackupCodesAction,
  startTotpEnrollment as startTotpEnrollmentAction,
  verifyTotpEnrollment as verifyTotpEnrollmentAction,
} from './session/totp.ts';

export type {
  SessionChangePasswordInput,
  SessionRecoverInput,
  SessionRecoveryCodeResult,
  SessionRegisterInput,
  SessionRegisterResult,
} from './session/types.ts';

/**
 * Module-level latch. Multiple components call `useSession()` across
 * the app (ProtectedRoute, Layout, Login, …); we need exactly ONE
 * hydration round-trip at app startup, not one per subscriber.
 * Without this guard, a second mount's `setAuthLoading()` would
 * race-reset the auth slice back to `loading` after an earlier one
 * settled it — ProtectedRoute would then stay stuck on its
 * null-render branch forever on a cold reload of `/flow`.
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

  return {
    status,
    user,
    login: (body: Parameters<typeof loginAction>[1]) =>
      loginAction({ setAuth, setMainKey }, body),
    prepareRegistration: prepareRegistrationAction,
    finishRegistration: finishRegistrationAction,
    logout: async (redirectTo: string = '/login'): Promise<void> => {
      try {
        await apiLogout();
      } finally {
        // Reset the hydration latch so a subsequent login on the
        // same React session re-runs the /auth/me round-trip.
        hydrationStarted = false;
        resetAll();
        // Encrypted draft slots stay decryptable only by this
        // account, but their key names + timestamps reveal module
        // usage to the next person on a shared computer — purge
        // them with the session (audit 2026-06).
        purgeLocalDrafts();
        // Force a full reload (CLAUDE.md crypto rule 7 : « Full purge
        // = location.reload() »). `wipeMainKeyMaterial` cannot erase
        // the `CryptoKey` references kept on the JS heap, and the
        // browser's bfcache can otherwise restore an authenticated
        // page on Back. `replace` (not `assign`) drops the current
        // entry so Back doesn't even land on it. The `redirectTo`
        // override lets callers like ChangePassword land on
        // `/login?password-changed=1` to surface the success banner.
        if (typeof window !== 'undefined') {
          window.location.replace(redirectTo);
        }
      }
    },
    changePassword: (input: Parameters<typeof changePasswordAction>[1]) =>
      changePasswordAction({ user, setAuth, setMainKey }, input),
    setupRecoveryCode: (currentPassword: string) =>
      setupRecoveryCodeAction({ user, setAuth, setMainKey }, currentPassword),
    recoverWithCode: (input: Parameters<typeof recoverWithCodeAction>[1]) =>
      recoverWithCodeAction({ setAuth, setMainKey }, input),
    reverifyRecoveryCode: (mnemonic: string) =>
      reverifyRecoveryCodeAction({ setAuth }, mnemonic),
    enrollPasskey: (currentPassword: string, label: string) =>
      enrollPasskeyAction({ user, setAuth }, currentPassword, label),
    renamePasskey: (id: string, currentPassword: string, label: string) =>
      renamePasskeyAction({ user }, id, currentPassword, label),
    removePasskey: (id: string, currentPassword: string) =>
      removePasskeyAction({ user, setAuth }, id, currentPassword),
    loginWithPasskey: (input: { email?: string }) =>
      passkeyLoginAction({ user, setAuth, setMainKey, markKeyMissing }, input),
    startTotpEnrollment: (currentPassword: string) =>
      startTotpEnrollmentAction({ user }, currentPassword),
    verifyTotpEnrollment: (code: string) =>
      verifyTotpEnrollmentAction({ user, setAuth }, code),
    disableTotp: (currentPassword: string) =>
      disableTotpAction({ user, setAuth }, currentPassword),
    regenerateTotpBackupCodes: (currentPassword: string) =>
      regenerateTotpBackupCodesAction({ user, setAuth }, currentPassword),
    verifyMfaTotp: (code: string) => verifyMfaTotpAction({ setAuth }, code),
    verifyMfaPasskey: () => verifyMfaPasskeyAction({ setAuth }),
    verifyMfaPassword: (password: string) =>
      verifyMfaPasswordAction({ setAuth, setMainKey }, password),
    changeSecurityMode: (
      mode: Parameters<typeof changeSecurityModeAction>[1],
      currentPassword: string,
    ) => changeSecurityModeAction({ user, setAuth }, mode, currentPassword),
    requestMfaBypass: requestMfaBypassAction,
  };
}
