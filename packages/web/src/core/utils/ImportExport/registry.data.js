// Chargeurs dynamiques par module (lazy import).
//
// Chaque plugin exporte `meta.id` (clé utilisée dans le JSON d'export/import)
// et `meta.runtimeKey` (clé dans le Zustand modules slice, pour résoudre
// le sid du module utilisateur courant).
const loaders = {
  mood: () => import("@/core/utils/ImportExport/Mood.jsx"),
  passage: () => import("@/core/utils/ImportExport/Passage.jsx"),
  goals: () => import("@/core/utils/ImportExport/Goals.jsx"),
  habits_items: () => import("@/core/utils/ImportExport/HabitsItems.jsx"),
  habits_logs: () => import("@/core/utils/ImportExport/HabitsLogs.jsx"),
  library_items: () => import("@/core/utils/ImportExport/LibraryItems.jsx"),
  library_reviews: () => import("@/core/utils/ImportExport/LibraryReviews.jsx"),
  review: () => import("@/core/utils/ImportExport/Review.jsx"),
};

// Alias de compatibilité : anciens exports pouvaient utiliser "habits" /
// "library" avant le split items / logs (habits) ou items / reviews
// (library). On les redirige vers la variante "items" par défaut.
const aliases = {
  habits: "habits_items",
  library: "library_items",
};

const cache = new Map();

/**
 * Retourne le plugin "data" d'un module.
 *
 * @param {string} moduleKey - ex: "mood" ou "habits_items"
 * @returns {Promise<object>} plugin (meta, importHandler, exportQuery, ...)
 */
export async function getDataPlugin(moduleKey) {
  let key = String(moduleKey || "").toLowerCase();
  if (aliases[key]) key = aliases[key];
  if (!loaders[key]) {
    throw new Error(`Module inconnu ou non configuré: "${moduleKey}"`);
  }
  if (cache.has(key)) return cache.get(key);

  const mod = await loaders[key]();
  const plugin = mod?.default ?? mod;
  cache.set(key, plugin);
  return plugin;
}

export function knownModules() {
  return Object.keys(loaders);
}

export function hasModule(moduleKey) {
  const k = String(moduleKey || "").toLowerCase();
  return Boolean(loaders[k] || loaders[aliases[k]]);
}

export default { getDataPlugin, knownModules, hasModule };
