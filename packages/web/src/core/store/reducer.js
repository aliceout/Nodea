// ------------------------
// ÉTAT INITIAL
// ------------------------
// C'est la forme par défaut du store global.
// Chaque clé est un "sous-état" géré par le reducer.
export const initialState = {
  nav: {
    currentTab: "home",
  },
  ui: {
    mobileOpen: false,
    theme: "system",
  },
  journal: {
    draft: null,
    filters: { month: null, year: null },
  },
  notifications: [],
  // Ajout pour la gestion de la clé
  mainKey: null, // CryptoKey ou null
  keyStatus: "ready", // 'ready' | 'missing' | 'error'
};

// ------------------------
// TYPES D’ACTIONS
// ------------------------
// Chaque type correspond à une modification précise du store.
// Le nom est en "namespace/action" pour éviter les collisions.
export const types = {
  NAV_SET_TAB: "nav/setTab",
  UI_OPEN_MOBILE: "ui/openMobile",
  UI_CLOSE_MOBILE: "ui/closeMobile",
  UI_TOGGLE_MOBILE: "ui/toggleMobile",
  UI_SET_THEME: "ui/setTheme",
  JOURNAL_SET_DRAFT: "journal/setDraft",
  JOURNAL_CLEAR_DRAFT: "journal/clearDraft",
  TOAST_PUSH: "toast/push",
  TOAST_DISMISS: "toast/dismiss",
  // Actions pour la clé
  KEY_SET: "key/set", // Met à jour mainKey
  KEY_STATUS: "key/status", // Met à jour keyStatus
};

// ------------------------
// REDUCER PRINCIPAL
// ------------------------
// Cette fonction reçoit :
// - l’état actuel (`state`)
// - une action { type, payload }
// et renvoie un nouvel état modifié sans toucher à l’original.
// Chaque `case` gère un type d’action.
export function reducer(state, action) {
  switch (action.type) {
    case types.NAV_SET_TAB:
      return { ...state, nav: { ...state.nav, currentTab: action.payload } };
    case types.UI_OPEN_MOBILE:
      return { ...state, ui: { ...state.ui, mobileOpen: true } };
    case types.UI_CLOSE_MOBILE:
      return { ...state, ui: { ...state.ui, mobileOpen: false } };
    case types.UI_TOGGLE_MOBILE:
      return {
        ...state,
        ui: { ...state.ui, mobileOpen: !state.ui.mobileOpen },
      };
    case types.UI_SET_THEME:
      return { ...state, ui: { ...state.ui, theme: action.payload } };
    case types.JOURNAL_SET_DRAFT:
      return { ...state, journal: { ...state.journal, draft: action.payload } };
    case types.JOURNAL_CLEAR_DRAFT:
      return { ...state, journal: { ...state.journal, draft: null } };
    case types.TOAST_PUSH:
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case types.TOAST_DISMISS:
      return {
        ...state,
        notifications: state.notifications.filter(
          (t) => t.id !== action.payload
        ),
      };
    // Gestion de la clé
    case types.KEY_SET:
      return { ...state, mainKey: action.payload };
    case types.KEY_STATUS:
      return { ...state, keyStatus: action.payload };
    default:
      return state;
  }
}
