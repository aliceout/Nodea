import source from './content/advanced.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — onglet « La mécanique ».
 *
 * Audience : lecteur·ice avec un peu de bagage technique. On
 * vulgarise la mécanique sans formaliser ; les détails crypto vivent
 * dans l'onglet Tech sécu. Le contenu est dans
 * `./content/advanced.md` — édite-le directement, le rendu et la
 * TOC se mettent à jour tout seuls.
 */

export const tocSections = parseToc(source);

export default function DocsTierAdvanced() {
  return <MarkdownTier source={source} />;
}
