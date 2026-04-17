import clsx from "clsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function SubNavDesktop({ title, tabs = [], onTabSelect }) {
  const { t } = useI18n();
  if (!tabs.length) return null;

  const ariaTitle = title || t("layout.subnav.sectionsFallback", {
    defaultValue: "Sections",
  });
  const ariaLabel = t("layout.subnav.sectionsAria", {
    defaultValue: `${ariaTitle} tabs`,
    values: { title: ariaTitle },
  });

  return (
    // cachǸ en mobile ; visible md+ ; prend la place restante
    <nav
      className="hidden md:flex items-center gap-1 flex-1 md:overflow-x-auto md:whitespace-nowrap lg:overflow-visible "
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const label = tab.label
          ? t(tab.label, { defaultValue: tab.label })
          : "";
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabSelect?.(tab.id)}
            className={clsx(
              "px-3 py-1.5 text-sm rounded-md transition",
              tab.active
                ? "bg-none text-nodea-sage-darker bg-nodea-sand hover:bg-nodea-sage-lighter"
                : "text-nodea-sage-dark hover:bg-nodea-sage-lighter/50"
            )}
          >
            {label}
          </button>
        );
      })}
    </nav>
  );
}
