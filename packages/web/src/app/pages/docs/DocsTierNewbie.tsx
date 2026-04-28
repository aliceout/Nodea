import source from './content/newbie.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — onglet « L'essentiel ».
 *
 * Audience : visiteur·e qui découvre Nodea et veut comprendre en
 * deux minutes ce que ça change pour ses données. Zéro jargon, des
 * analogies concrètes, l'essentiel dit honnêtement. Le contenu vit
 * dans `./content/newbie.md` — modifie là, le rendu suit
 * automatiquement (et la table des matières aussi).
 */

export const tocSections = parseToc(source);

export default function DocsTierNewbie() {
  return <MarkdownTier source={source} />;
}
