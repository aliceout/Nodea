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
 * Three safety rails (audit 2026-06 + passe 2) :
 *   - **Read-only on corrupt blob.** A blob that exists but fails
 *     to decrypt/parse (`null` from the client) flips writes off —
 *     re-encrypting the in-memory defaults over it would
 *     permanently destroy every stored preference.
 *   - **Read-then-merge after a transport-failed load.** If the
 *     INITIAL GET fails on the network, the store holds only
 *     defaults + whatever the user changed this session. Blindly
 *     PUTting that would reset every UNTOUCHED preference (theme,
 *     language, viewModes…) to default on the server (passe 2). So
 *     a write in the `failed` state re-attempts the GET, and merges
 *     the fresh server blob UNDER the keys the user actually wrote
 *     this session (tracked in `dirtyKeys`) before PUTting. If the
 *     re-GET fails too we keep the optimistic state but DON'T write
 *     (we still don't know the server's truth).
 *   - **Hydration never clobbers fresher local writes.** Every
 *     `usePreferences` mount fires a GET ; a stale response that
 *     lost the race re-applies local values on top via the write
 *     sequence, and `dismissedAnnouncements` is always merged as a
 *     UNION (dismissing is monotonic).
 */

/**
 * Hydration latch. `unknown` until the first load round-trip
 * settles ; writes WAIT on it rather than guessing (the first-run
 * seed fires `setPreferences` at Layout mount, often before the
 * GET resolves). `failed` = transport error on the initial load —
 * distinct from `ok`/`corrupt` so a write can recover via
 * read-then-merge instead of blind-writing (passe 2). Module-level
 * on purpose : every hook instance shares it, and the full-reload
 * logout wipes it with the rest of the JS heap.
 */
let hydration: 'unknown' | 'ok' | 'corrupt' | 'failed' = 'unknown';
let hydrationWaiters: Array<() => void> = [];

function settleHydration(state: 'ok' | 'corrupt' | 'failed'): void {
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

/** Preference keys the user explicitly wrote THIS session. Used by
 *  the transport-failed recovery path to merge only deliberate
 *  changes over a freshly-fetched server blob, instead of writing
 *  the whole (mostly-default) store. */
const dirtyKeys = new Set<keyof UserPreferencesPayload>();

/**
 * Serialised write chain (audit 2026-06 passe 2, Priorité 4). Two
 * settings changed in quick succession fire two PUTs ; if the FIRST
 * (still carrying only change A) lands AFTER the second (carrying
 * A + B) because of network reordering, the server ends on `{A}` and
 * B is silently lost. Chaining the saves guarantees each PUT only
 * leaves once the previous one resolved, so they always arrive in
 * call order. Each task reads the store at execution time, so the
 * last writer ships the freshest full blob. Module-level (shared by
 * every hook instance), wiped by the full-reload logout. */
let prefsWriteChain: Promise<unknown> = Promise.resolve();

function enqueuePrefsWrite(task: () => Promise<void>): Promise<void> {
  // Run after the previous write settles, success OR failure (a failed
  // PUT must not wedge the queue forever).
  const run = prefsWriteChain.then(task, task);
  // Keep the chain tail un-rejected so a thrown task doesn't surface as
  // an unhandled rejection nor poison the next link.
  prefsWriteChain = run.catch(() => undefined);
  return run;
}

function unionDismissed(
  server: UserPreferencesPayload,
  local: UserPreferencesPayload,
): string[] | undefined {
  const a = server.dismissedAnnouncements ?? [];
  const b = local.dismissedAnnouncements ?? [];
  if (a.length === 0 && b.length === 0) return undefined;
  return Array.from(new Set([...a, ...b]));
}

/** Build the payload to PUT after recovering a transport-failed
 *  load : the fresh server blob, overlaid with only the keys the
 *  user deliberately changed this session, plus the monotonic
 *  dismissed-announcements union. */
function mergeDirtyOverServer(
  server: UserPreferencesPayload,
  local: UserPreferencesPayload,
): UserPreferencesPayload {
  const merged: UserPreferencesPayload = { ...server };
  for (const k of dirtyKeys) {
    if (k === 'dismissedAnnouncements') continue;
    const v = local[k];
    if (v !== undefined) {
      (merged as Record<string, unknown>)[k] = v;
    }
  }
  const dismissed = unionDismissed(server, local);
  if (dismissed) merged.dismissedAnnouncements = dismissed;
  return merged;
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
        // corrupt blob : settle `failed` (not `ok`) so a subsequent
        // write recovers via read-then-merge instead of blind-
        // writing the mostly-default store over the server (passe 2).
        // `failed` still resolves the waiters → no deadlock.
        settleHydration('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [isAuth, mainKey, setStore]);

  const setPreferences = useCallback(
    async (partial: Partial<UserPreferencesPayload>): Promise<void> => {
      localWriteSeq += 1;
      for (const k of Object.keys(partial) as Array<keyof UserPreferencesPayload>) {
        dirtyKeys.add(k);
      }
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

      if (hydration === 'failed') {
        // The initial load never reached the server. Re-attempt it
        // now and merge our deliberate changes over the fresh blob,
        // so untouched preferences keep their server values (passe 2).
        try {
          const server = await loadDecryptedPreferences(mainKey.aesKey);
          if (server === null) {
            // The blob turns out to be corrupt, not just unreachable.
            settleHydration('corrupt');
            return;
          }
          const local = useNodeaStore.getState().preferences;
          const merged = mergeDirtyOverServer(server, local);
          setStore(merged);
          settleHydration('ok');
          await saveEncryptedPreferences(mainKey.aesKey, merged);
        } catch {
          // Still can't reach the server — keep the optimistic local
          // state, but DON'T write : we'd clobber the unknown server
          // blob. `failed` stays, so the next write retries.
          if (import.meta.env.DEV)
            console.warn('preferences: write deferred (server unreachable)');
        }
        return;
      }

      // hydration === 'ok' : the store already reflects server ∪ local,
      // so writing the whole store is correct. Serialised so two rapid
      // writes can't reorder on the wire and drop a change (see
      // `enqueuePrefsWrite`). The store is read INSIDE the task — when
      // this write's turn actually comes — so the last writer always
      // ships the freshest full blob.
      await enqueuePrefsWrite(async () => {
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
      });
    },
    [mainKey, update, setStore],
  );

  return { preferences, setPreferences };
}
