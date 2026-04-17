import { useEffect } from "react";
import clsx from "clsx";
import {
  ComputerDesktopIcon,
  MoonIcon,
  SunIcon,
} from "@heroicons/react/24/outline";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import { useTheme } from "@/core/theme/useTheme";
import { useUserPreferences } from "@/core/preferences/useUserPreferences";

const OPTIONS = [
  { id: "light", icon: SunIcon },
  { id: "system", icon: ComputerDesktopIcon },
  { id: "dark", icon: MoonIcon },
];

export default function ThemeSelector({
  variant = "compact",
  className = "",
}) {
  const { t } = useI18n();
  const { theme, setTheme } = useTheme();
  const { preferences, updatePreferences, isSaving } = useUserPreferences();

  useEffect(() => {
    const storedTheme = preferences?.theme;
    if (
      storedTheme &&
      (storedTheme === "light" || storedTheme === "dark" || storedTheme === "system") &&
      storedTheme !== theme
    ) {
      setTheme(storedTheme);
    }
  }, [preferences?.theme, setTheme, theme]);

  const handleSelect = async (nextTheme) => {
    if (!nextTheme || nextTheme === theme) return;
    const previous = theme;
    setTheme(nextTheme);
    try {
      await updatePreferences((current = {}) => ({
        ...current,
        theme: nextTheme,
      }));
    } catch (error) {
      console.error("[ThemeSelector] save error", error);
      setTheme(previous);
    }
  };

  return (
    <div
      role="group"
      aria-label={t("settings.theme.ariaLabel")}
      className={clsx(
        "rounded-full border border-gray-200 bg-white/80 p-1 shadow-sm",
        "dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none",
        variant === "compact"
          ? "inline-flex items-center gap-px"
          : "flex flex-wrap items-center justify-between gap-2 sm:inline-flex sm:gap-px",
        variant === "card" ? "w-full sm:w-auto" : "",
        className
      )}
    >
      {OPTIONS.map(({ id, icon: Icon }) => {
        const active = theme === id;
        const label = t(`settings.theme.options.${id}`);
        return (
          <button
            key={id}
            type="button"
            onClick={() => handleSelect(id)}
            disabled={isSaving}
            className={clsx(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-nodea-sky-dark",
              active
                ? "bg-nodea-sky-dark text-white shadow-sm dark:bg-slate-600 dark:text-white"
                : "text-slate-600 hover:bg-gray-100 dark:text-slate-300 dark:hover:bg-slate-700/60",
              variant === "card" ? "sm:text-sm sm:px-4 sm:py-2" : ""
            )}
            aria-pressed={active}
            aria-label={label}
            title={label}
          >
            <Icon
              className={clsx(
                variant === "card" ? "size-5" : "size-4",
                active ? "opacity-100" : "opacity-80"
              )}
            />
            {variant === "card" ? <span>{label}</span> : null}
          </button>
        );
      })}
    </div>
  );
}
