import source from './content/tech.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — onglet « Sous le capot ».
 *
 * Audience : auditeur·ice / contributeur·ice / lecteur·ice
 * technique. Source unique du modèle de sécurité « sous le capot »
 * (le repo-side `docs/Security.md` historique a été fusionné ici).
 * Renvoie ponctuellement vers `docs/Auth-Spec.md` pour la spec auth
 * exhaustive. Le contenu vit dans `./content/tech.md`.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const tocSections = parseToc(source);

export default function DocsTierTech() {
  return <MarkdownTier source={source} />;
}
