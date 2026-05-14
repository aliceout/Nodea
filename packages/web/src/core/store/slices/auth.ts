/**
 * Auth slice — session status + the lean public-safe user shape.
 *
 * Sits inside `useNodeaStore` (Zustand slice pattern, see ADR-0013).
 * The `loggedOutAuth` constant is exported alongside the slice creator
 * because the assembly file's `resetAll` action needs to flip the auth
 * sub-state to `unauthenticated` (not back to the initial `loading`).
 *
 * **API-14 split** : the OPAQUE wrap blobs (`wrappedMainKey`,
 * `wrappedKekPassword`, …) used to live on the user shape. They moved
 * to `GET /auth/me/crypto` so the lean `/me` payload doesn't ship
 * ~2 KB of unused crypto on every page load. Consumers that need to
 * unwrap (change-password, recovery-code setup, passkey enroll) call
 * `apiMeCrypto()` at the moment of need.
 */
import type { StateCreator } from 'zustand';
import type { NodeaState } from '../nodea-store.ts';

export type AuthStatus = 'unauthenticated' | 'loading' | 'authenticated';

/**
 * Public-safe user shape returned by `/auth/me`. Never includes secrets.
 */
export interface SessionUser {
  id: string;
  email: string;
  /** Optional public display name. `null` until the user sets one. */
  username: string | null;
  role: 'user' | 'admin';
  onboardingStatus: 'pending' | 'complete';
  onboardingVersion: string;
  /** True when the user has set up a BIP39 recovery code (Phase 3).
   *  Drives the sidebar warning + the Settings setup vs regenerate
   *  affordance. */
  recoveryCodeSet: boolean;
  /** Total passkeys enrolled (Phase 4). Drives the sidebar tip
   *  inviting enrollment when 0. */
  passkeysCount: number;
  /** Subset that are PRF-capable. Required >= 1 to activate mode
   *  `maximum` (Auth-Spec §6.1). */
  passkeysPrfCount: number;
  /** True when TOTP is fully enabled (Auth-Roadmap Phase 5). */
  totpEnabled: boolean;
  /** Unused backup codes left. UI warns at 0. */
  totpBackupCodesRemaining: number;
  /** Per-user security policy (Auth-Spec §6.1). */
  securityMode: 'password_or_passkey' | 'always_2fa' | 'maximum';
}

export interface AuthSlice {
  auth: {
    status: AuthStatus;
    user: SessionUser | null;
  };
  setAuth(user: SessionUser | null): void;
  setAuthLoading(): void;
}

/**
 * Initial auth state. `loading` (not `unauthenticated`) so the first
 * render of `ProtectedRoute` waits for the session hydration round-trip
 * before deciding whether to redirect — otherwise a cold reload flashes
 * `/login` before `/auth/me` has had a chance to answer.
 * `resetAll()` flips it to `unauthenticated` because at that point we
 * know for sure there's no session.
 */
export const emptyAuth: AuthSlice['auth'] = { status: 'loading', user: null };
export const loggedOutAuth: AuthSlice['auth'] = { status: 'unauthenticated', user: null };

export const createAuthSlice: StateCreator<NodeaState, [], [], AuthSlice> = (set) => ({
  auth: emptyAuth,
  setAuth: (user) =>
    set({
      auth: user
        ? { status: 'authenticated', user }
        : { status: 'unauthenticated', user: null },
    }),
  setAuthLoading: () => set({ auth: { status: 'loading', user: null } }),
});
