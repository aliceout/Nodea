import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and re-render on match changes.
 *
 * For the rare case a layout decision is data-driven, not just a CSS
 * `lg:` toggle — e.g. the Homepage heatmaps render *fewer week columns*
 * on small screens (3 months vs 6) so the squares stay tappable, and
 * the column count is JS state, not a class.
 *
 * SSR-safe initial value (`false`) ; the effect corrects it on mount.
 * Pass a stable query string (a literal, or a memoised one) — the
 * listener re-subscribes whenever `query` changes.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false,
  );

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return;
    }
    const mql = window.matchMedia(query);
    const onChange = (): void => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);

  return matches;
}
