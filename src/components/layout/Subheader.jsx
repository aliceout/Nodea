// src/components/layout/Subheader.jsx
import clsx from "clsx";
import { useMemo } from "react";

import { useStore } from "../../store/StoreProvider";
import { selectCurrentTab } from "../../store/selectors";
import { nav } from "./Navigation";

import SubNavDesktop from "./components/SubNavDesktop";
import SubNavMobile from "./components/SubNavMobile";

export default function Subheader({ tabs = [], onTabSelect, className }) {
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const current = selectCurrentTab(state);

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
      {/* Une seule barre : titre + nav responsive */}
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-4">
        {title ? (
          <h1 className="shrink-0 text-base font-semibold leading-6 text-gray-900">
            {title}
          </h1>
        ) : null}

        {/* Desktop / Tablette : liens visibles, scrollables en md si besoin */}
        <SubNavDesktop tabs={tabs} onTabSelect={onTabSelect} title={title} />

        {/* Mobile : menu “more” à droite */}
        <SubNavMobile tabs={tabs} onTabSelect={onTabSelect} />
      </div>
    </div>
  );
}
