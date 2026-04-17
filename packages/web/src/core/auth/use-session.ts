/**
 * Session hook for the new back.
 *
 * Replaces the legacy `useAuth.js` (PB authStore). Keeps the Zustand
 * store in sync with `/auth/me` — on mount, on route focus, and after
 * any login/register/logout/change-password call.
 *
 * This hook never stores crypto material. Deriving and hydrating the
 * main key from the user's `encryptedKey` is a separate concern handled
 * in a dedicated hook in Phase 6 (when the KEK unwrap UX lands).
 */
import { useEffect } from 'react';
import { useNodeaStore, selectAuthStatus, selectUser } from '../store/nodea-store.ts';
import { apiLogin, apiLogout, apiMe, apiRegister, apiChangePassword } from '../api/client.ts';
import type {
  LoginBody,
  RegisterBody,
  ChangePasswordBody,
} from '@nodea/shared';

export function useSession() {
  const status = useNodeaStore(selectAuthStatus);
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);
  const setAuthLoading = useNodeaStore((s) => s.setAuthLoading);
  const resetAll = useNodeaStore((s) => s.resetAll);

  // Initial hydration on mount.
  useEffect(() => {
    let cancelled = false;
    setAuthLoading();
    apiMe()
      .then((me) => {
        if (cancelled) return;
        setAuth(me);
      })
      .catch(() => {
        if (!cancelled) setAuth(null);
      });
    return () => {
      cancelled = true;
    };
  }, [setAuth, setAuthLoading]);

  async function login(body: LoginBody): Promise<void> {
    await apiLogin(body);
    const me = await apiMe();
    setAuth(me);
  }

  async function register(body: RegisterBody): Promise<void> {
    await apiRegister(body);
    const me = await apiMe();
    setAuth(me);
  }

  async function logout(): Promise<void> {
    try {
      await apiLogout();
    } finally {
      resetAll();
    }
  }

  async function changePassword(body: ChangePasswordBody): Promise<void> {
    await apiChangePassword(body);
    const me = await apiMe();
    setAuth(me);
  }

  return { status, user, login, register, logout, changePassword };
}
