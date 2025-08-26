// src/components/layout/Navigation.jsx
// -------------------------------------------------------------
// Adapte le manifeste MODULES pour l’UI existante :
// - exporte `nav` (array) que Header/Sidebar consomment
// - conserve element/display/to pour le Layout
// -------------------------------------------------------------
import { MODULES } from "@/config/modules_list.jsx";

// Ici on ne touche pas aux icônes : Header/Sidebar n’en ont pas besoin.
// Si un jour tu en veux, ajoute "icon" côté MODULES et utilise-le là-bas.
export const nav = MODULES.map((m) => ({
  id: m.id,
  label: m.label,
  to: m.to,
  element: m.element,
  display: m.display !== false,
  to_toggle: !!m.to_toggle,
  collection: m.collection ?? null,
  description: m.description ?? "",
}));

// Petit helper optionnel
export const findNavByPath = (path) => nav.find((i) => i.to === path) || nav[0];
