// ------------------------
// ÉTAT INITIAL
// ------------------------
// C'est la forme par défaut du store global.
// Chaque clé est un "sous-état" géré par le reducer.
export const initialState = {
  nav: {
    // Onglet actif dans l'application
    // Utilisé pour savoir quel composant afficher dans <Layout>
    currentTab: "home",
  },
  ui: {
    // true = le menu latéral mobile est ouvert
    // false = il est fermé
    mobileOpen: false,

    // Thème d'affichage : "light", "dark" ou "system"
    theme: "system",
  },
  journal: {
    // Brouillon de saisie du journal (Mood journal)
    // Peut contenir un objet avec mood, emoji, texte, etc.
    draft: null,

    // Filtres appliqués sur l’historique du journal
    // month/year sont null si aucun filtre actif
    filters: { month: null, year: null },
  },
  // Liste des notifications toast à afficher.
  // Chaque toast a { id, type: 'success'|'error', message }
  notifications: [],
};

// ------------------------
// TYPES D’ACTIONS
// ------------------------
// Chaque type correspond à une modification précise du store.
// Le nom est en "namespace/action" pour éviter les collisions.
export const types = {
  NAV_SET_TAB: "nav/setTab", // Changer l’onglet actif
  UI_OPEN_MOBILE: "ui/openMobile", // Ouvrir le menu mobile
  UI_CLOSE_MOBILE: "ui/closeMobile", // Fermer le menu mobile
  UI_TOGGLE_MOBILE: "ui/toggleMobile", // Basculer l’état du menu mobile
  UI_SET_THEME: "ui/setTheme", // Changer le thème
  JOURNAL_SET_DRAFT: "journal/setDraft", // Sauvegarder un brouillon
  JOURNAL_CLEAR_DRAFT: "journal/clearDraft", // Supprimer le brouillon
  TOAST_PUSH: "toast/push", // Ajouter un toast
  TOAST_DISMISS: "toast/dismiss", // Retirer un toast
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
    // NAVIGATION -------------------------
    case types.NAV_SET_TAB:
      // Met à jour l’onglet courant
      return { ...state, nav: { ...state.nav, currentTab: action.payload } };

    // UI : MENU MOBILE --------------------
    case types.UI_OPEN_MOBILE:
      // Force l'ouverture
      return { ...state, ui: { ...state.ui, mobileOpen: true } };
    case types.UI_CLOSE_MOBILE:
      // Force la fermeture
      return { ...state, ui: { ...state.ui, mobileOpen: false } };
    case types.UI_TOGGLE_MOBILE:
      // Inverse l’état actuel (ouvert/fermé)
      return {
        ...state,
        ui: { ...state.ui, mobileOpen: !state.ui.mobileOpen },
      };

    // UI : THÈME --------------------------
    case types.UI_SET_THEME:
      // Définit explicitement le thème
      return { ...state, ui: { ...state.ui, theme: action.payload } };

    // JOURNAL -----------------------------
    case types.JOURNAL_SET_DRAFT:
      // Sauvegarde un brouillon de journal
      return { ...state, journal: { ...state.journal, draft: action.payload } };
    case types.JOURNAL_CLEAR_DRAFT:
      // Efface le brouillon
      return { ...state, journal: { ...state.journal, draft: null } };

    // NOTIFICATIONS (TOASTS) ---------------
    case types.TOAST_PUSH:
      // Ajoute un toast à la liste
      return {
        ...state,
        notifications: [...state.notifications, action.payload],
      };
    case types.TOAST_DISMISS:
      // Supprime un toast en filtrant par id
      return {
        ...state,
        notifications: state.notifications.filter(
          (t) => t.id !== action.payload
        ),
      };

    // PAR DÉFAUT ---------------------------
    default:
      // Si l’action n’est pas reconnue, on ne change rien
      return state;
  }
}
