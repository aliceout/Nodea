import { useCallback, useEffect } from 'react';
import {
  useNodeaStore,
  selectMainKey,
  selectPreferences,
  selectIsAuthenticated,
} from '@/core/store/nodea-store';
import {
  loadDecryptedPreferences,
  saveEncryptedPreferences,
} from '@/core/api/preferences-client';
import type { UserPreferencesPayload } from '@nodea/shared';

/**
 * Reactive accessor for the encrypted user preferences blob.
 *
 * - Hydrates the Zustand `preferences` slice from `/user-preferences`
 *   as soon as we have both an authenticated session and a main key.
 * - Exposes an imperative `setPreferences(partial)` that merges into
 *   the current preferences and PUTs the re-encrypted envelope.
 * - Swallows transport / decrypt errors — the caller gets the current
 *   (possibly stale) slice instead of a thrown exception.
 *
 * Cross-device sync comes for free: every device loads the same
 * encrypted blob on login, decrypts locally, and writes back on change.
 *
 * Two safety rails (audit 2026-06) :
 *   - **Read-only on corrupt blob.** A blob that exists but fails
 *     to decrypt/parse (`null` from the client) flips writes off —
 *     re-encrypting the in-memory defaults over it would
 *     permanently destroy every stored preference.
 *   - **Hydration never clobbers fresher local writes.** Every
 *     `usePreferences` mount fires a GET ; if the user dismissed an
 *     announcement (or changed any pref) while one of those GETs
 *     was in flight, the stale response used to overwrite the store
 *     and the announcement reappeared. We track a module-level
 *     write sequence : a hydration that lost the race re-applies
 *     local values on top, and `dismissedAnnouncements` is always
 *     merged as a UNION (dismissing is monotonic — an id seen
 *     dismissed anywhere stays dismissed).
 */

/**
 * Hydration latch. `unknown` until the first load round-trip
 * settles ; writes WAIT on it rather than guessing (the first-run
 * seed fires `setPreferences` at Layout mount, often before the
 * GET resolves — guessing `false` would silently drop it, guessing
 * `true` would re-introduce the clobber). Module-level on purpose :
 * every hook instance shares it, and the full-reload logout wipes
 * it with the rest of the JS heap.
 */
let hydration: 'unknown' | 'ok' | 'corrupt' = 'unknown';
let hydrationWaiters: Array<() => void> = [];

function settleHydration(state: 'ok' | 'corrupt'): void {
  hydration = state;
  const waiters = hydrationWaiters;
  hydrationWaiters = [];
  for (const w of waiters) w();
}

function waitForHydration(): Promise<void> {
  if (hydration !== 'unknown') return Promise.resolve();
  return new Promise((resolve) => hydrationWaiters.push(resolve));
}

/** Bumped on every local write — lets a resolving GET detect that
 *  it raced a fresher local mutation. */
let localWriteSeq = 0;

function unionDismissed(
  server: UserPreferencesPayload,
  local: UserPreferencesPayload,
): string[] | undefined {
  const a = server.dismissedAnnouncements ?? [];
  const b = local.dismissedAnnouncements ?? [];
  if (a.length === 0 && b.length === 0) return undefined;
  return Array.from(new Set([...a, ...b]));
}

export function usePreferences(): {
  preferences: UserPreferencesPayload;
  setPreferences: (partial: Partial<UserPreferencesPayload>) => Promise<void>;
} {
  const mainKey = useNodeaStore(selectMainKey);
  const isAuth = useNodeaStore(selectIsAuthenticated);
  const preferences = useNodeaStore(selectPreferences);
  const setStore = useNodeaStore((s) => s.setPreferences);
  const update = useNodeaStore((s) => s.updatePreferences);

  // Hydrate when (isAuth, mainKey) becomes truthy. We deliberately do
  // NOT dedup via a `useRef` sentinel: combined with React 18
  // StrictMode's mount → cleanup → mount effect cycle, the sentinel
  // would mark the slot as hydrated on the first (doomed-to-cancel)
  // run and skip the second — leaving the store on its defaults. The
  // effect deps already constrain how often we fetch; a double-fetch
  // in dev is cheap and writes the same value.
  useEffect(() => {
    if (!isAuth || !mainKey) return;
    let cancelled = false;
    const seqAtFetch = localWriteSeq;
    loadDecryptedPreferences(mainKey.aesKey)
      .then((p) => {
        if (p === null) {
          // Blob exists but can't be read — keep the in-memory
          // slice, refuse writes (see header comment). Settled
          // even when this effect instance was cancelled : the
          // outcome is instance-independent.
          settleHydration('corrupt');
          return;
        }
        settleHydration('ok');
        if (cancelled) return;
        const local = useNodeaStore.getState().preferences;
        const dismissed = unionDismissed(p, local);
        const merged: UserPreferencesPayload =
          seqAtFetch === localWriteSeq
            ? // No local write raced this GET — server wins, modulo
              // the monotonic dismissed-announcements union.
              { ...p, ...(dismissed ? { dismissedAnnouncements: dismissed } : {}) }
            : // A local write landed while the GET was in flight —
              // local values win, the stale response only fills gaps.
              {
                ...p,
                ...local,
                ...(dismissed ? { dismissedAnnouncements: dismissed } : {}),
              };
        setStore(merged);
      })
      .catch(() => {
        // Transport blip — keep current in-memory slice. NOT a
        // corrupt blob : settle as writable (legacy semantics) so
        // queued writes don't deadlock waiting for a GET that
        // already failed.
        settleHydration('ok');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth, mainKey, setStore]);

  const setPreferences = useCallback(
    async (partial: Partial<UserPreferencesPayload>): Promise<void> => {
      localWriteSeq += 1;
      update(partial);
      if (!mainKey) return;
      // Wait for the first load to settle — writing before knowing
      // whether the stored blob is readable risks replacing it with
      // our (mostly default) in-memory state.
      await waitForHydration();
      if (hydration === 'corrupt') {
        // Local optimistic state stays ; the server copy is
        // preserved for a future session with a working key.
        if (import.meta.env.DEV)
          console.warn('preferences: write skipped (stored blob unreadable)');
        return;
      }
      // Recompute AFTER the wait — the hydration merge may have
      // landed in between, and `partial` is already in the store.
      const next: UserPreferencesPayload = {
        ...useNodeaStore.getState().preferences,
      };
      try {
        await saveEncryptedPreferences(mainKey.aesKey, next);
      } catch {
        // Write failed — keep the optimistic state; next reload will
        // re-sync from the server. A toast surface could be added
        // later when the notifications slice wires up UI.
      }
    },
    [mainKey, update],
  );

  return { preferences, setPreferences };
}
