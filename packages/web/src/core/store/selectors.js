// ------------------------
// SELECTORS
// ------------------------
// Les "selectors" sont des petites fonctions
// qui extraient une donnée précise du store global.
// Elles évitent de dupliquer la logique d'accès au state
// dans les composants.

// Onglet courant (id de l'onglet actif dans la navigation)
export const selectCurrentTab = (state) => state.nav.currentTab;

// État d'ouverture du menu mobile (true = ouvert, false = fermé)
export const selectMobileOpen = (state) => state.ui.mobileOpen;

// Thème actuel ("light", "dark", ou "system")
export const selectTheme = (state) => state.ui.theme;

// Brouillon actuel du journal (Mood journal)
export const selectJournalDraft = (state) => state.journal.draft;

// Liste complète des notifications toast en attente d'affichage
export const selectToasts = (state) => state.notifications;
