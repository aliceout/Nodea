/**
 * Per-key mutation tracker — protects optimistic-update rollbacks
 * from race conditions (FRONT-13).
 *
 * The optimistic-update pattern used across Mood / Goals / Library /
 * Journal is :
 *
 *   1. Capture current state.
 *   2. Apply optimistic update locally.
 *   3. Fire the server call.
 *   4. On failure, restore the captured state.
 *
 * That last step is racey when two mutations on the same entry
 * overlap. Imagine the user clicks « cycle status » twice on the
 * same goal in 200 ms :
 *
 *   - Mutation A : capture status=open, optimistic→wip, fire, …
 *   - Mutation B : capture status=wip   (the in-flight optimistic
 *                  state from A), optimistic→done, fire, …
 *   - A fails    : restore status=open. **B's optimistic « done »
 *                  is now silently overwritten** even though B is
 *                  still in flight and might succeed.
 *
 * The fix : assign a unique token to every mutation, track the
 * latest token *per key* (per entry id, typically). When a
 * mutation's catch block fires, it only rolls back if its token
 * is still the latest for that key — otherwise a newer mutation
 * has taken over the entry's state and the older rollback is
 * stale.
 *
 * The tracker is **per-hook-instance**, not module-level — created
 * via `useRef(createMutationTracker())` so component remount
 * (logout / login) starts with a clean slate.
 */
export interface MutationTracker<TKey> {
  /** Start a new mutation for a key. Returns a single-use token
   *  the caller passes back to {@link isLatest} on success / failure. */
  begin(key: TKey): string;
  /** Returns true if the given token is still the latest mutation
   *  registered for this key. False means a newer mutation has
   *  started since (and any rollback this caller would do is stale). */
  isLatest(key: TKey, token: string): boolean;
  /** Drop a key from the tracker — useful after a successful delete
   *  (no future mutation can target a removed entry). Optional ; the
   *  tracker holds at most one token per key, so leaks are bounded. */
  forget(key: TKey): void;
}

export function createMutationTracker<TKey>(): MutationTracker<TKey> {
  const latestByKey = new Map<TKey, string>();
  return {
    begin(key) {
      const token = crypto.randomUUID();
      latestByKey.set(key, token);
      return token;
    },
    isLatest(key, token) {
      return latestByKey.get(key) === token;
    },
    forget(key) {
      latestByKey.delete(key);
    },
  };
}
