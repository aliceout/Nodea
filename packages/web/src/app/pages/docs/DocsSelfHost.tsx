import source from './content/self-host.md?raw';
import { MarkdownTier, parseToc } from './primitives';

/**
 * Docs — section « Auto-héberger ».
 *
 * Audience : opérateur·rice qui héberge sa propre instance Nodea
 * (sur VPS, NAS, machine perso). Couvre l'install Docker, les
 * variables d'environnement critiques, le reverse proxy, les
 * mises à jour, le backup et le diagnostic en panne. Le contenu
 * reprend et complète le README racine du repo.
 */

// eslint-disable-next-line react-refresh/only-export-components
export const tocSections = parseToc(source);

export default function DocsSelfHost() {
  return <MarkdownTier source={source} />;
}
