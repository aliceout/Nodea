export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export type BackgroundShade =
  | 'cream'
  | 'alabaster'
  | 'ivory'
  | 'pearl'
  | 'pebble';
export const BACKGROUND_SHADE_VALUES: ReadonlyArray<BackgroundShade> = [
  'cream',
  'alabaster',
  'ivory',
  'pearl',
  'pebble',
];

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

/**
 * Push the chosen background shade onto `<html>` as a
 * `data-bg-shade` attribute. `dirk.css` keys per-shade overrides on
 * that attribute, so this is a one-line DOM write — no extra
 * stylesheet juggling. The default `cream` shade matches `:root`,
 * so removing the attribute is the right way to reset.
 */
export function applyBackgroundShade(shade: BackgroundShade): BackgroundShade {
  if (typeof document === 'undefined') return shade;
  const root = document.documentElement;
  if (shade === 'cream') {
    delete root.dataset.bgShade;
  } else {
    root.dataset.bgShade = shade;
  }
  return shade;
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
