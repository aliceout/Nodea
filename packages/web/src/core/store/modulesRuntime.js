import { useEffect, useSyncExternalStore } from "react";

/**
 * State = objet déchiffré des modules, ex:
 * {
 *   mood: { enabled: true, module_user_id: "...", delete_secret: "...", algo: "v1" },
 *   goals: { enabled: false, ... }
 * }
 */
let _state = {};
const _listeners = new Set();

function emit() {
  for (const cb of _listeners) cb();
}

export function getModulesState() {
  return _state;
}

export function setModulesState(next) {
  _state = next || {};
  emit();
}

export function updateSingleModule(moduleId, partial) {
  _state = {
    ..._state,
    [moduleId]: { ...(_state[moduleId] || {}), ...partial },
  };
  emit();
}

export function subscribe(callback) {
  _listeners.add(callback);
  return () => _listeners.delete(callback);
}

/**
 * Hook de lecture réactive de l’état runtime des modules.
 */
export function useModulesRuntime() {
  const snapshot = () => _state;
  const getServerSnapshot = () => _state;
  return useSyncExternalStore(subscribe, snapshot, getServerSnapshot);
}

/**
 * Helpers de lecture
 */
export function isModuleEnabled(state, moduleId) {
  return !!state?.[moduleId]?.enabled;
}

export function enabledModules(state) {
  return Object.entries(state || {})
    .filter(([, v]) => !!v?.enabled)
    .map(([k]) => k);
}
