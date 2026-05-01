/**
 * Lazy plugin registry for the Import/Export pipeline.
 *
 * Each module ships a plugin under `./<Module>.ts` with the
 * shape declared in [`./types.ts`](./types.ts) — `meta`,
 * `importHandler`, `exportQuery`, etc. The registry imports
 * them on demand (so a user who never opens the data panel
 * doesn't pay for parsing the 7 plugins).
 *
 * `aliases` keeps backward compat with old export envelopes
 * that used the pre-split keys « habits » / « library » (when
 * Habits hadn't been split into items + logs and Library
 * hadn't been split into items + reviews). Those collapse
 * onto the « items » variant by default.
 */

import type { ImportExportPlugin } from './types.ts';

type ModuleKey =
  | 'mood'
  | 'goals'
  | 'habits_items'
  | 'habits_logs'
  | 'library_items'
  | 'library_reviews'
  | 'review';

type PluginLoader = () => Promise<{ default: ImportExportPlugin }>;

const loaders: Record<ModuleKey, PluginLoader> = {
  mood: () => import('./mood.ts'),
  goals: () => import('./goals.ts'),
  habits_items: () => import('./habits-items.ts'),
  habits_logs: () => import('./habits-logs.ts'),
  library_items: () => import('./library-items.ts'),
  library_reviews: () => import('./library-reviews.ts'),
  review: () => import('./review.ts'),
};

const aliases: Readonly<Record<string, ModuleKey>> = {
  habits: 'habits_items',
  library: 'library_items',
};

const cache = new Map<ModuleKey, ImportExportPlugin>();

function isKnownKey(key: string): key is ModuleKey {
  return Object.hasOwn(loaders, key);
}

/**
 * Resolve a plugin by module key. Aliases (`habits`, `library`)
 * collapse onto their canonical variant. Throws on unknown keys ;
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
