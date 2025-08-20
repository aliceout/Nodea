import clsx from "clsx";
import { useMemo } from "react";

import { selectCurrentTab } from "../../store/selectors";
import { useStore } from "../../store/StoreProvider";
import { nav } from "./Navigation";

export default function Subheader({
  tabs = [], // [{ id, label, active }]
  onTabSelect, // (id) => void
  className,
}) {
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const current = selectCurrentTab(state);

  // Titre basé sur la nav + l’onglet courant
  const title = useMemo(() => {
    return nav.find((t) => t.id === current)?.title ?? "";
  }, [current]);

  return (
    <div
      className={clsx(
        "sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200 ",
        className
      )}
    >
      <div className="mx-auto  px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-start gap-12">
        {title ? (
          <h1 className="text-base font-semibold leading-6 text-gray-900">
            {title}
          </h1>
        ) : null}
        <div className="hidden md:flex items-center gap-4">
          <nav className="flex items-center gap-1" aria-label={`${title} tabs`}>
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onTabSelect?.(t.id)}
                className={clsx(
                  "px-3 py-1.5 text-sm rounded-md transition",
                  t.active
                    ? "bg-none text-nodea-sage-darker bg-nodea-sand hover:bg-nodea-sage-lighter"
                    : "text-nodea-sage-dark hover:bg-nodea-sage-lighter"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  );
}
