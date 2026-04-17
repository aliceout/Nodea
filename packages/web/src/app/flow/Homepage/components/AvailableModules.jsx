import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import Surface from "@/ui/atoms/layout/Surface.jsx";

export default function AvailableModules({ modules, onNavigate }) {
  const { t } = useI18n();
  if (!modules.length) return null;

  return (
    <Surface tone="muted" border="default" padding="lg" className="space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
        {t("home.sections.available.title", { defaultValue: "Modules disponibles" })}
      </h3>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        {t("home.sections.available.description", {
          defaultValue: "Active de nouveaux espaces pour enrichir ton accompagnement.",
        })}
      </p>

      <div className="flex flex-wrap gap-2">
        {modules.map((module) => {
          const Icon = module.icon;
          const label = t(module.label, { defaultValue: module.label });
          return (
            <span
              key={module.id}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--border-default)] bg-[var(--surface-subtle)] px-3 py-1 text-sm text-[var(--text-secondary)]"
            >
              {Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}
              {label}
            </span>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => onNavigate("settings")}
        className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 dark:bg-slate-600 dark:hover:bg-slate-500"
      >
        {t("home.sections.available.cta", { defaultValue: "Ouvrir les paramètres" })}
        <ArrowRightIcon className="h-4 w-4" aria-hidden="true" />
      </button>
    </Surface>
  );
}

