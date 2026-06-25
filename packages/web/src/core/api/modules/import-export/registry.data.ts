/**
 * Lazy plugin registry for the Import/Export pipeline.
 *
 * Each module ships a plugin under `./<Module>.ts` with the
 * shape declared in [`./types.ts`](./types.ts) — `meta`,
 * `importHandler`, `exportQuery`, etc. The registry imports
 * them on demand (so a user who never opens the data panel
 * doesn't pay for parsing every module's plugin).
 *
 * `aliases` keeps backward compat with old export envelopes
 * that used the pre-split key « library » (before Library was
 * split into items + reviews). It collapses onto the « items »
 * variant by default.
 */

import type { ImportExportPlugin } from './types.ts';

type ModuleKey =
  | 'mood'
  | 'goals'
  | 'journal'
  | 'library_items'
  | 'library_reviews'
  | 'review'
  | 'hrt_products'
  | 'hrt_admin_logs'
  | 'hrt_lab_results'
  | 'hrt_schedules';

type PluginLoader = () => Promise<{ default: ImportExportPlugin }>;

// HRT order is intentional: `hrt_products` comes before the admin logs and
// schedules that reference a product by name, so a restore recreates the
// catalog first (the reference is a plain string, so this is for tidiness,
// not referential integrity).
const loaders: Record<ModuleKey, PluginLoader> = {
  mood: () => import('./mood.ts'),
  goals: () => import('./goals.ts'),
  journal: () => import('./journal.ts'),
  library_items: () => import('./library-items.ts'),
  library_reviews: () => import('./library-reviews.ts'),
  review: () => import('./review.ts'),
  hrt_products: () => import('./hrt-products.ts'),
  hrt_admin_logs: () => import('./hrt-admin-logs.ts'),
  hrt_lab_results: () => import('./hrt-lab-results.ts'),
  hrt_schedules: () => import('./hrt-schedules.ts'),
};

const aliases: Readonly<Record<string, ModuleKey>> = {
  library: 'library_items',
};

const cache = new Map<ModuleKey, ImportExportPlugin>();

function isKnownKey(key: string): key is ModuleKey {
  return Object.hasOwn(loaders, key);
}

/**
 * Resolve a plugin by module key. The `library` alias collapses
 * onto its canonical variant. Throws on unknown keys ;
 * memoises so repeat calls return the same module instance.
 */
export async function getDataPlugin(
  moduleKey: string,
): Promise<ImportExportPlugin> {
  const lowered = moduleKey.toLowerCase();
  const resolved = aliases[lowered] ?? lowered;
  if (!isKnownKey(resolved)) {
    throw new Error(`Module inconnu ou non configuré : « ${moduleKey} »`);
  }
  const cached = cache.get(resolved);
  if (cached) return cached;

  const mod = await loaders[resolved]();
  cache.set(resolved, mod.default);
  return mod.default;
}

export function knownModules(): readonly ModuleKey[] {
  return Object.keys(loaders) as ModuleKey[];
}

export function hasModule(moduleKey: string): boolean {
  const lowered = moduleKey.toLowerCase();
  const resolved = aliases[lowered] ?? lowered;
  return isKnownKey(resolved);
}
