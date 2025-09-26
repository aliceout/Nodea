// Chargeurs dynamiques par module (lazy import)
// MAJ: anciens chemins '@/services/ImportExport/*' remplacés par l'emplacement actuel des plugins
const loaders = {
  mood: () => import("@/core/utils/importExport/plugins/Mood.jsx"),
  passage: () => import("@/core/utils/importExport/plugins/Passage.jsx"),
  goals: () => import("@/core/utils/importExport/plugins/Goals.jsx"),
};

// Cache pour éviter de recharger les plugins
const cache = new Map();

/**
 * Retourne le plugin "data" d'un module (objet exporté, idéalement le default)
 * @param {string} moduleKey - ex: "mood"
 * @returns {Promise<object>} plugin du module (expose importHandler, exportQuery, exportSerialize, etc.)
 */
export async function getDataPlugin(moduleKey) {
  const key = String(moduleKey || "").toLowerCase();
  if (!key || !loaders[key]) {
    throw new Error(`Module inconnu ou non configuré: "${moduleKey}"`);
  }
  if (cache.has(key)) return cache.get(key);

  const mod = await loaders[key]();
  const plugin = mod?.default ?? mod;
  cache.set(key, plugin);
  return plugin;
}

/** Liste des modules connus (facultatif) */
export function knownModules() {
  return Object.keys(loaders);
}

/** Test d’existence (facultatif) */
export function hasModule(moduleKey) {
  return !!loaders[String(moduleKey || "").toLowerCase()];
}

export default { getDataPlugin, knownModules, hasModule };
