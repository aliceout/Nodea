import source from './content/tech.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — onglet « Sous le capot ».
 *
 * Audience : auditeur·ice / contributeur·ice / lecteur·ice
 * technique. Le tier reste concis et linke vers `docs/Auth-Spec.md`
 * et `docs/Security.md` au lieu de dupliquer la spec exhaustive.
 * Le contenu vit dans `./content/tech.md`.
 */

export const tocSections = parseToc(source);

export default function DocsTierTech() {
  return <MarkdownTier source={source} />;
}
