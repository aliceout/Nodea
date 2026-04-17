export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)';

function getMediaQuery(): MediaQueryList | null {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }
  return window.matchMedia(COLOR_SCHEME_QUERY);
}

export function resolveAppliedTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'dark') return 'dark';
  if (preference === 'light') return 'light';
  const media = getMediaQuery();
  return media?.matches ? 'dark' : 'light';
}

export function applyTheme(preference: ThemePreference): ResolvedTheme {
  if (typeof document === 'undefined') return resolveAppliedTheme(preference);

  const root = document.documentElement;
  const resolved = resolveAppliedTheme(preference);

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference ?? 'system';
  root.classList.toggle('dark', resolved === 'dark');
  try {
    root.style.setProperty('color-scheme', resolved);
  } catch {
    // Older browsers.
  }
  return resolved;
}

export function watchSystemThemeChanges(
  callback: (resolved: ResolvedTheme) => void,
): () => void {
  const media = getMediaQuery();
  if (!media || typeof media.addEventListener !== 'function') return () => {};

  const handler = (event: MediaQueryListEvent): void => {
    callback(event.matches ? 'dark' : 'light');
  };
  media.addEventListener('change', handler);
  return () => media.removeEventListener('change', handler);
}
