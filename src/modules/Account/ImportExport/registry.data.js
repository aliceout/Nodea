// src/modules/Account/components/registry.data.js
// Table de routage (lazy) moduleId → loader Import/Export du module.
// Chaque module exporte par défaut un objet { meta, importHandler, exportQuery, exportSerialize }.

const DATA_REGISTRY = {
  mood: () => import("@/modules/Mood/data/ImportExport.jsx"),
  // goals: () => import("@/modules/Goals/data/ImportExport.jsx"),
  // … ajoute d'autres modules ici
};

/**
 * getDataPlugin(moduleId)
 * Charge dynamiquement le plugin "données" du module.
 * Retourne l'export par défaut (ou le module entier si pas de default).
 */
export async function getDataPlugin(moduleId) {
  const loader = DATA_REGISTRY[moduleId];
  if (!loader) {
    throw new Error(`Module inconnu: ${moduleId}`);
  }
  const mod = await loader();
  return mod.default ?? mod;
}

/**
 * hasModule(moduleId)
 * Vérifie si un module est enregistré (utile côté UI).
 */
export function hasModule(moduleId) {
  return Boolean(DATA_REGISTRY[moduleId]);
}

/**
 * listModules()
 * Liste des moduleIds connus (utile pour UI/exports multi-modules).
 */
export function listModules() {
  return Object.keys(DATA_REGISTRY);
}
