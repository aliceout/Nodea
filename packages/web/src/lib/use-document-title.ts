import { useEffect } from 'react';

/**
 * Set `document.title` for the lifetime of the calling component.
 *
 * Used by every public page to give browser tabs a human-readable
 * label (FRONT-04). The hook appends « — Nodea » so each page only
 * passes the page-specific part :
 *
 * ```tsx
 * useDocumentTitle('Connexion');  // → "Connexion — Nodea"
 * ```
 *
 * **Privacy invariant** : authenticated `/flow` pages must NOT call
 * this hook with a per-module string — the tab title would leak the
 * active module to anyone shoulder-surfing or screen-recording. The
 * default static `<title>Nodea</title>` from `index.html` stays in
 * place for the entire authenticated surface. See CLAUDE.md
 * « Frontend rules → Routing » for the URL/title leakage rules.
 *
 * On unmount the title is reset to the static default so a back-
 * navigation to /flow after visiting /docs doesn't keep the « Documentation »
 * suffix.
 */
export function useDocumentTitle(title: string, suffix = 'Nodea'): void {
  useEffect(() => {
    const previous = document.title;
    document.title = `${title} — ${suffix}`;
    return () => {
      document.title = previous;
    };
  }, [title, suffix]);
}
