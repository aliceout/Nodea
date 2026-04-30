/**
 * The set of valid module ids the flow can show.
 *
 * Promoted from `packages/web/src/core/store/nodea-store.ts` so the
 * api side can type its module-id arguments against the same union
 * (the seed orchestrator and the modules-config helpers used to take
 * `string`, leaving room for typo-bugs).
 *
 * Frozen tuple so `ModuleId` is a strict union (no widening to plain
 * `string`) and so the popstate listener on the front can
 * discriminate a known id from arbitrary garbage in `event.state`.
 *
 * `settings` (alias to `account`) is intentionally absent — it was
 * killed alongside the URL-routing rework. `home` is the cold-start
 * default ; `account` and `admin` are reachable but hidden from the
 * public module list (`display: false` in `modules_list.tsx`).
 *
 * Reference: `docs/roadmap/health.md` Tier B.5.
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
  return (
    typeof value === 'string' && (MODULE_IDS as readonly string[]).includes(value)
  );
}

/**
 * Subset of {@link MODULE_IDS} that owns an entry in the user's
 * encrypted `modules_config` blob. The other ids (`home`, `account`,
 * `admin`) are routing-only — they don't have per-user state of their
 * own.
 *
 * Used by both the web (when it generates / reads sids) and the api
 * seed orchestrator. Adding a new data module = add to this list +
 * the matching `DataModuleId` lookup gets the new key automatically.
 */
export const DATA_MODULE_IDS = [
  'mood',
  'journal',
  'goals',
  'habits',
  'library',
  'review',
] as const;

export type DataModuleId = (typeof DATA_MODULE_IDS)[number];

export function isDataModuleId(value: unknown): value is DataModuleId {
  return (
    typeof value === 'string' &&
    (DATA_MODULE_IDS as readonly string[]).includes(value)
  );
}
