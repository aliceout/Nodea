const COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";

function getMediaQuery() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return null;
  }
  return window.matchMedia(COLOR_SCHEME_QUERY);
}

export function resolveAppliedTheme(preference) {
  if (preference === "dark") return "dark";
  if (preference === "light") return "light";

  const media = getMediaQuery();
  if (media?.matches) return "dark";
  return "light";
}

export function applyTheme(preference) {
  if (typeof document === "undefined") return resolveAppliedTheme(preference);

  const root = document.documentElement;
  const resolved = resolveAppliedTheme(preference);

  root.dataset.theme = resolved;
  root.dataset.themePreference = preference ?? "system";
  root.classList.toggle("dark", resolved === "dark");
  try {
    root.style.setProperty("color-scheme", resolved);
  } catch {
    // Ignore failures on older browsers.
  }

  return resolved;
}

export function watchSystemThemeChanges(callback) {
  const media = getMediaQuery();
  if (!media || typeof media.addEventListener !== "function") {
    return () => {};
  }

  const handler = (event) => {
    callback(event.matches ? "dark" : "light");
  };

  media.addEventListener("change", handler);
  return () => {
    media.removeEventListener("change", handler);
  };
}

