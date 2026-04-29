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
import type {
  GoalsPayload,
  LibraryItemPayload,
  LibraryReviewPayload,
  MoodPayload,
  PassagePayload,
  UserPreferencesPayload,
} from '@nodea/shared';

/**
 * The set of valid module ids the flow can show. Kept as a frozen
 * tuple so `ModuleId` is a strict union (no widening to plain
 * `string`) and so the popstate listener can discriminate a known
 * id from arbitrary garbage in `event.state`.
 *
 * `settings` (alias to `account`) is intentionally absent — it was
 * killed alongside the URL-routing rework. `home` is the cold-start
 * default ; `account` and `admin` are reachable but hidden from the
 * public module list (`display: false` in `modules_list.tsx`).
 */
export const MODULE_IDS = [
  'home',
  'mood',
  'journal',
  'goals',
  'habits',
  'library',
  'review',
  'account',
  'admin',
] as const;
export type ModuleId = (typeof MODULE_IDS)[number];

export function isModuleId(value: unknown): value is ModuleId {
  return typeof value === 'string' && (MODULE_IDS as readonly string[]).includes(value);
}

/**
 * Library has three lenses on the same encrypted catalogue : the
 * books themselves, the highlighted extracts, the freeform notes.
 * The active lens used to live in the URL (`?subview=`) — moved
 * here as part of the `/flow` URL-freezing rework so the server
 * never sees which sub-page the user is on.
 */
export const LIBRARY_SUBVIEWS = ['livres', 'extraits', 'notes'] as const;
export type LibrarySubview = (typeof LIBRARY_SUBVIEWS)[number];

export function isLibrarySubview(value: unknown): value is LibrarySubview {
  return (
    typeof value === 'string' && (LIBRARY_SUBVIEWS as readonly string[]).includes(value)
  );
}

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
  /** Base64 AES-GCM ciphertext of the random main key under the
   *  random KEK. Set ONCE at register, never re-wrapped. */
  wrappedMainKey: string | null;
  wrappedMainKeyIv: string | null;
  /** Base64 AES-GCM ciphertext of the KEK under an HKDF sub-key of
   *  the OPAQUE `exportKey`. Re-wrapped at change-password. */
  wrappedKekPassword: string | null;
  wrappedKekPasswordIv: string | null;
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
  securityMode: 'password_or_passkey' | 'always_totp' | 'maximum';
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

  // --- Flow routing (URL stays at /flow ; module is store state) ---
  // Privacy invariant : no module-visited / sub-view metadata leaks
  // through Nginx access logs, Hono/Pino request logs, or browser
  // referrers. The browser history API still tracks navigation, with
  // `nodeaModule` in the entry's state payload — useful for the back
  // button without revealing anything in the URL or sent to the server.
  flow: {
    currentModule: ModuleId;
    librarySubview: LibrarySubview;
  };
  /**
   * Imperative module switch. Pushes a new browser history entry so the
   * back button works, then updates the store. No-op if the target is
   * already the current module (avoids polluting the back-stack with
   * duplicates when the same sidebar item is clicked twice).
   */
  setModule(id: ModuleId): void;
  /**
   * Internal — called by the popstate listener when the user hits
   * back/forward. Updates the store WITHOUT calling `pushState`,
   * otherwise we'd corrupt the very history we're responding to.
   */
  syncCurrentModule(id: ModuleId): void;
  setLibrarySubview(sub: LibrarySubview): void;

  // --- UI: ⌘K composer modal (Direction K) ---
  composer: {
    open: boolean;
    type: ComposerType;
    /** When set, the matching body prefills its form from the
     * payload and switches its save flow from create → update. */
    editing: ComposerEditing | null;
  };
  openComposer(type?: ComposerType, editing?: ComposerEditing): void;
  closeComposer(): void;
  setComposerType(type: ComposerType): void;

  // --- Per-module mutation versions ---
  // Bumped after a successful create / update / delete on a given
  // module's collection. Pages include the matching version in their
  // fetch useEffect deps so newly persisted entries appear without a
  // page reload. A lightweight stand-in for TanStack Query's
  // `invalidateQueries` until the workspace adopts it.
  goalsVersion: number;
  bumpGoalsVersion(): void;
  moodVersion: number;
  bumpMoodVersion(): void;
  journalVersion: number;
  bumpJournalVersion(): void;
  libraryItemsVersion: number;
  bumpLibraryItemsVersion(): void;
  libraryReviewsVersion: number;
  bumpLibraryReviewsVersion(): void;

  // --- reset (on logout) ---
  resetAll(): void;
}

/**
 * The five entry archetypes the global composer can capture. Mirrors
 * the `K_Composer` type-picker in `Design/.../dir-k-extras.jsx`. The
 * `note` variant is a free-form journal entry that doesn't bind to
 * any specific module.
 */
export type ComposerType =
  | 'mood'
  | 'goal'
  | 'habit'
  | 'note'
  | 'journal'
  | 'library-item'
  | 'library-review';

/**
 * Discriminated record passed to `openComposer` when editing an
 * existing entry. Each body that supports edit reads the editing
 * slot (narrowed on `type`) and prefills its form. Passages /
 * Habits / Notes stay create-only for now — extend this union when
 * each gets its own rich body + edit flow.
 */
export type ComposerEditing =
  | { type: 'goal'; id: string; payload: GoalsPayload }
  | { type: 'mood'; id: string; payload: MoodPayload }
  | { type: 'journal'; id: string; payload: PassagePayload }
  | { type: 'library-item'; id: string; payload: LibraryItemPayload }
  | {
      type: 'library-review';
      id: string;
      payload: LibraryReviewPayload;
      /** When prefilling a brand-new review for a known item, the
       * editing entry is omitted — but we may still need to know
       * which item the review is being created against. The item
       * version uses `id` for the existing review id when editing,
       * and the body reads `payload.item_rid` from the prefilled
       * payload to pin the relation. */
    };

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

const initialFlow: NodeaState['flow'] = {
  currentModule: 'home',
  librarySubview: 'livres',
};

export const useNodeaStore = create<NodeaState>()((set, get) => ({
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

  flow: initialFlow,
  setModule: (id) => {
    const current = get().flow.currentModule;
    if (current === id) return;
    if (typeof window !== 'undefined') {
      window.history.pushState({ nodeaModule: id }, '', '/flow');
    }
    set((state) => ({ flow: { ...state.flow, currentModule: id } }));
  },
  syncCurrentModule: (id) =>
    set((state) => ({ flow: { ...state.flow, currentModule: id } })),
  setLibrarySubview: (sub) =>
    set((state) => ({ flow: { ...state.flow, librarySubview: sub } })),

  composer: { open: false, type: 'mood', editing: null },
  openComposer: (type, editing) =>
    set((state) => ({
      composer: {
        open: true,
        type: editing?.type ?? type ?? state.composer.type,
        editing: editing ?? null,
      },
    })),
  closeComposer: () =>
    set((state) => ({
      composer: { ...state.composer, open: false, editing: null },
    })),
  setComposerType: (type) =>
    set((state) => ({ composer: { ...state.composer, type, editing: null } })),

  goalsVersion: 0,
  bumpGoalsVersion: () => set((state) => ({ goalsVersion: state.goalsVersion + 1 })),
  moodVersion: 0,
  bumpMoodVersion: () => set((state) => ({ moodVersion: state.moodVersion + 1 })),
  journalVersion: 0,
  bumpJournalVersion: () =>
    set((state) => ({ journalVersion: state.journalVersion + 1 })),
  libraryItemsVersion: 0,
  bumpLibraryItemsVersion: () =>
    set((state) => ({ libraryItemsVersion: state.libraryItemsVersion + 1 })),
  libraryReviewsVersion: 0,
  bumpLibraryReviewsVersion: () =>
    set((state) => ({ libraryReviewsVersion: state.libraryReviewsVersion + 1 })),

  resetAll: () =>
    set({
      auth: loggedOutAuth,
      crypto: emptyCrypto,
      modules: {},
      preferences: {},
      notifications: [],
      mobileMenuOpen: false,
      flow: initialFlow,
      composer: { open: false, type: 'mood', editing: null },
      goalsVersion: 0,
      moodVersion: 0,
      journalVersion: 0,
      libraryItemsVersion: 0,
      libraryReviewsVersion: 0,
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
export const selectCurrentModule = (s: NodeaState) => s.flow.currentModule;
export const selectLibrarySubview = (s: NodeaState) => s.flow.librarySubview;
