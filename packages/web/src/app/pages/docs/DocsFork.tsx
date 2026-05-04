import source from './content/fork.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — section « Reprendre le projet ».
 *
 * Audience : développeur·euse qui télécharge Nodea pour s'en faire
 * sa propre version : comprendre comment c'est foutu, modifier ce
 * qu'iel veut, faire tourner sa fork. C'est PAS la doc de
 * contribution upstream (PR, conventions de commit, code-of-conduct)
 * — celle-là vit dans le `CONTRIBUTING.md` du repo, convention
 * standard GitHub.
 *
 * L'angle de cette page : « tu t'appropries le code », pas « tu
 * contribues au projet officiel ». La distinction matche les deux
 * publics réels : la majorité veut une instance perso modifiée à
 * son goût, une minorité veut soumettre des changements upstream.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const tocSections = parseToc(source);

export default function DocsFork() {
  return <MarkdownTier source={source} />;
}
