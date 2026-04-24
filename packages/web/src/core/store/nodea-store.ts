/**
 * Nodea's single application store (Zustand).
 *
 * This replaces two legacy systems that ran in parallel:
 *   1. `StoreProvider.jsx` (useReducer + Context): app-wide state
 *   2. `modulesRuntime.js` (singleton via useSyncExternalStore): per-module
 *      decrypted runtime config
 *
 * Both are now slices of one store. Subscribing via selectors avoids
 * rerenders on unrelated slice updates; the singleton + context duo is
 * gone.
 *
 * The legacy `.js` files remain in place during Phases 5–6 so the
 * still-JSX modules (Mood, Goals, Passage) keep working. Phase 6 will
 * migrate their imports to this store and the old files get deleted.
 */
import { create } from 'zustand';
import type { MainKeyMaterial } from '../crypto/key-material.ts';
import type { UserPreferencesPayload } from '@nodea/shared';

export type AuthStatus = 'unauthenticated' | 'loading' | 'authenticated';

/** Public-safe user shape returned by `/auth/me`. Never includes secrets. */
export interface SessionUser {
  id: string;
  email: string;
  /** Optional public display name. `null` until the user sets one. */
  username: string | null;
  role: 'user' | 'admin';
  onboardingStatus: 'pending' | 'complete';
  onboardingVersion: string;
  /** Base64 salt used with Argon2id to derive the KEK. Client-side only. */
  encryptionSalt: string;
  /** Base64 AES-GCM ciphertext of the main key under the KEK. */
  encryptedKey: string;
}

export type KeyStatus = 'idle' | 'ready' | 'missing' | 'error';

/** Per-module decrypted runtime config (what used to live in modulesRuntime). */
export interface ModuleRuntimeEntry {
  enabled: boolean;
  moduleUserId?: string;
  deleteSecret?: string;
  algo?: string;
}

export type ModulesRuntime = Record<string, ModuleRuntimeEntry>;

interface ToastNotification {
  id: string;
  kind: 'info' | 'success' | 'warning' | 'error';
  message: string;
}

export interface NodeaState {
  // --- auth ---
  auth: {
    status: AuthStatus;
    user: SessionUser | null;
  };
  setAuth(user: SessionUser | null): void;
  setAuthLoading(): void;

  // --- crypto ---
  crypto: {
    status: KeyStatus;
    main: MainKeyMaterial | null;
  };
  setMainKey(material: MainKeyMaterial | null): void;
  markKeyMissing(): void;

  // --- modules runtime ---
  modules: ModulesRuntime;
  setModules(next: ModulesRuntime): void;
  updateModule(id: string, partial: Partial<ModuleRuntimeEntry>): void;

  // --- user preferences (E2E encrypted, synced via /user-preferences) ---
  preferences: UserPreferencesPayload;
  setPreferences(next: UserPreferencesPayload): void;
  updatePreferences(partial: Partial<UserPreferencesPayload>): void;

  // --- UI notifications ---
  notifications: ToastNotification[];
  pushToast(n: Omit<ToastNotification, 'id'>): void;
  dismissToast(id: string): void;

  // --- UI: mobile sidebar drawer ---
  mobileMenuOpen: boolean;
  setMobileMenuOpen(open: boolean): void;

  // --- reset (on logout) ---
  resetAll(): void;
}

/**
 * Initial auth state. `loading` (not `unauthenticated`) so the first
 * render of `ProtectedRoute` waits for the session hydration round-trip
 * before deciding whether to redirect — otherwise a cold reload flashes
 * `/login` before `/auth/me` has had a chance to answer.
 * `resetAll()` flips it to `unauthenticated` because at that point we
 * know for sure there's no session.
 */
const emptyAuth: NodeaState['auth'] = { status: 'loading', user: null };
const loggedOutAuth: NodeaState['auth'] = { status: 'unauthenticated', user: null };
const emptyCrypto: NodeaState['crypto'] = { status: 'idle', main: null };

export const useNodeaStore = create<NodeaState>()((set) => ({
  auth: emptyAuth,
  setAuth: (user) =>
    set({
      auth: user
        ? { status: 'authenticated', user }
        : { status: 'unauthenticated', user: null },
    }),
  setAuthLoading: () => set({ auth: { status: 'loading', user: null } }),

  crypto: emptyCrypto,
  setMainKey: (material) =>
    set({
      crypto: material ? { status: 'ready', main: material } : { status: 'idle', main: null },
    }),
  markKeyMissing: () => set({ crypto: { status: 'missing', main: null } }),

  modules: {},
  setModules: (next) => set({ modules: next }),
  updateModule: (id, partial) =>
    set((state) => ({
      modules: {
        ...state.modules,
        [id]: {
          enabled: state.modules[id]?.enabled ?? false,
          ...state.modules[id],
          ...partial,
        },
      },
    })),

  preferences: {},
  setPreferences: (next) => set({ preferences: next }),
  updatePreferences: (partial) =>
    set((state) => ({ preferences: { ...state.preferences, ...partial } })),

  notifications: [],
  pushToast: (n) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { ...n, id: crypto.randomUUID() },
      ],
    })),
  dismissToast: (id) =>
    set((state) => ({ notifications: state.notifications.filter((t) => t.id !== id) })),

  mobileMenuOpen: false,
  setMobileMenuOpen: (open) => set({ mobileMenuOpen: open }),

  resetAll: () =>
    set({
      auth: loggedOutAuth,
      crypto: emptyCrypto,
      modules: {},
      preferences: {},
      notifications: [],
      mobileMenuOpen: false,
    }),
}));

// --- Selectors (memoised via referential equality in most cases) ---

export const selectUser = (s: NodeaState) => s.auth.user;
export const selectAuthStatus = (s: NodeaState) => s.auth.status;
export const selectIsAuthenticated = (s: NodeaState) => s.auth.status === 'authenticated';
export const selectMainKey = (s: NodeaState) => s.crypto.main;
export const selectKeyStatus = (s: NodeaState) => s.crypto.status;
export const selectModules = (s: NodeaState) => s.modules;
export const selectMobileMenuOpen = (s: NodeaState) => s.mobileMenuOpen;
/**
 * Count of currently-enabled modules. Exposed as a primitive (number)
 * rather than an array so the selector returns a stable reference
 * across renders — Zustand's default `Object.is` comparison would
 * otherwise re-render every subscriber on every store update (see
 * React's "getSnapshot should be cached" warning).
 */
export const selectEnabledModuleCount = (s: NodeaState): number => {
  let n = 0;
  for (const key in s.modules) {
    if (s.modules[key]?.enabled) n += 1;
  }
  return n;
};
export const selectPreferences = (s: NodeaState) => s.preferences;
