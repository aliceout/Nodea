/**
 * Tiny helper to anchor a process-wide singleton on `globalThis`.
 *
 * Vitest 4 re-evaluates ESM modules per test file even with
 * `isolate: false` (upstream issue #9217, closed not-planned), so a
 * plain `const map = new Map()` at module scope creates one Map per
 * module instance. When the route handler binds to instance A and
 * the test setup's `__reset*` binds to instance B, the test thinks
 * it cleared state while the route still reads stale entries (or
 * vice-versa) — the OPAQUE login suite shows this as
 * "client.finishLogin returned undefined".
 *
 * Stashing the underlying storage on `globalThis` makes every
 * module instance reach for the same object, so any number of
 * re-evaluations still resolve to a single shared store. In a real
 * runtime the module is loaded once, so the cost is one extra
 * `globalThis` property per state holder — invisible.
 *
 * Keep the keys unique and prefixed with `__nodea_` to avoid any
 * collision with third-party libs that also stash on global.
 */
export function globalSingleton<T>(key: string, factory: () => T): T {
  const g = globalThis as Record<string, unknown>;
  const existing = g[key];
  if (existing !== undefined) return existing as T;
  const fresh = factory();
  g[key] = fresh;
  return fresh;
}
