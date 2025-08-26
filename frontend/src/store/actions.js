import { types } from "./reducer";

/**
 * Définit l'onglet actif (ex: "home", "journal", "settings", etc.)
 * @param {string} id - L'identifiant de l'onglet à afficher.
 */
export const setTab = (id) => ({
  type: types.NAV_SET_TAB,
  payload: id,
});

/*** Ouvre le menu latéral en mode mobile. */
export const openMobile = () => ({
  type: types.UI_OPEN_MOBILE,
});

/*** Ferme le menu latéral en mode mobile. */
export const closeMobile = () => ({
  type: types.UI_CLOSE_MOBILE,
});

/*** Bascule l'état du menu latéral en mode mobile (ouvert <-> fermé). */
export const toggleMobile = () => ({
  type: types.UI_TOGGLE_MOBILE,
});

/*** Change le thème visuel de l'application.
 * @param {string} theme - Nom du thème à appliquer (ex: "light", "dark").
 */
export const setTheme = (theme) => ({
  type: types.UI_SET_THEME,
  payload: theme,
});

/**
 * Sauvegarde temporairement un brouillon de journal.
 * Utilisé avant soumission, pour éviter la perte de contenu.
 * @param {object} draft - Contenu du brouillon.
 */
export const setJournalDraft = (draft) => ({
  type: types.JOURNAL_SET_DRAFT,
  payload: draft,
});

/**
 * Efface le brouillon de journal actuellement sauvegardé.
 */
export const clearJournalDraft = () => ({
  type: types.JOURNAL_CLEAR_DRAFT,
});

/**
 * Ajoute une notification (toast) à l'écran.
 * @param {object} toast - Objet contenant { id, type, message }.
 *   - id {string} : identifiant unique
 *   - type {string} : ex. "success", "error", "info"
 *   - message {string} : texte affiché
 */
export const pushToast = (toast) => ({
  type: types.TOAST_PUSH,
  payload: toast,
});

/**
 * Supprime une notification (toast) par son identifiant.
 * @param {string} id - Identifiant du toast à retirer.
 */
export const dismissToast = (id) => ({
  type: types.TOAST_DISMISS,
  payload: id,
});
