import clsx from "clsx";
import { useMemo } from "react";

import { useStore } from "@/core/store/StoreProvider";
import { selectCurrentTab } from "@/core/store/selectors";
import { MODULES } from "@/app/config/modules_list";
import SubNavDesktop from "../components/SubNavDesktop";
import SubNavMobile from "../components/SubNavMobile";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function Subheader({ tabs = [], onTabSelect, className }) {
  const store = useStore();
  const state = store?.state ?? store?.[0];
  const current = selectCurrentTab(state);
  const { t } = useI18n();

  const title = useMemo(() => {
    const moduleEntry = MODULES.find((item) => item.id === current);
    if (!moduleEntry?.label) return "";
    return t(moduleEntry.label, { defaultValue: moduleEntry.label });
  }, [current, t]);

  return (
    <div
      className={clsx(
        "sticky top-16 z-30 bg-white/80 backdrop-blur border-b border-slate-200",
        className
      )}
    >
      <div className="mx-auto px-4 sm:px-6 lg:px-8 h-12 flex items-center gap-4">
        {title ? (
          <h1 className="shrink-0 text-base lg:text-center font-semibold leading-6 text-gray-900  lg:w-[106px]">
            {title}
          </h1>
        ) : null}

        <SubNavDesktop tabs={tabs} onTabSelect={onTabSelect} title={title} />
        <SubNavMobile tabs={tabs} onTabSelect={onTabSelect} />
      </div>
    </div>
  );
}
