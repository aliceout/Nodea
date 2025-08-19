import clsx from "clsx";
import { useMemo } from "react";

import { selectCurrentTab } from "../../store/selectors";
import { useStore } from "../../store/StoreProvider";
import { nav } from "./Navigation";

export default function Subheader({
  tabs = [], // [{ id, label, active }]
  onTabSelect, // (id) => void
  cta, // { label, onClick, disabled? }
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
        "sticky top-0 z-30 bg-white/80 backdrop-blur border-b border-slate-200",
        className
      )}
    >
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
        {title ? (
          <h1 className="text-base font-semibold leading-6 text-gray-900">
            {title}
          </h1>
        ) : null}
        <div className="flex items-center gap-4">
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
        {cta && (
          <button
            type="button"
            onClick={cta.onClick}
            disabled={cta.disabled}
            className={clsx(
              "inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-md ",
              cta.disabled
                ? "bg-white border-1 text-slate-400 cursor-not-allowed"
                : "bg-nodea-sage-lighter  text-nodea-sage-dark hover:bg-nodea-sage hover:text-white transition-colors"
            )}
          >
            {cta.label}
          </button>
        )}
      </div>
    </div>
  );
}
