import source from './content/contribute.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — section « Contribuer ».
 *
 * Audience : développeur·euse externe qui veut comprendre comment
 * setup l'env local, lancer les tests, et contribuer au code sans
 * casser les invariants crypto. Le contenu est progressivement
 * transféré depuis `docs/Development.md` du repo vers cette page —
 * l'objectif final est que `nodea.app/docs/contribute` soit la
 * source de vérité, et que le repo ne contienne plus qu'un README
 * minimal qui pointe ici.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const tocSections = parseToc(source);

export default function DocsContribute() {
  return <MarkdownTier source={source} />;
}
