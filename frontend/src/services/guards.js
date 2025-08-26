// Stocke les guards par collection et par record.id en localStorage.
// Minimal, sans dépendance ni refacto.

const KEY = "nodea.guards.v1";

function loadAll() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}

function saveAll(obj) {
  localStorage.setItem(KEY, JSON.stringify(obj));
}

export function setEntryGuard(collection, id, guard) {
  if (!collection || !id || !guard) return;
  const all = loadAll();
  all[collection] = all[collection] || {};
  all[collection][id] = guard;
  saveAll(all);
}

export function getEntryGuard(collection, id) {
  const all = loadAll();
  return all?.[collection]?.[id] || "";
}

export function deleteEntryGuard(collection, id) {
  const all = loadAll();
  if (all?.[collection]?.[id]) {
    delete all[collection][id];
    saveAll(all);
  }
}
