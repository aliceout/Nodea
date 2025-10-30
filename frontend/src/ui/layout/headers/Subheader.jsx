import clsx from "clsx";
import { useMemo } from "react";

import { useStore } from "@/core/store/StoreProvider";
import { selectCurrentTab } from "@/core/store/selectors";
import { MODULES } from "@/app/config/modules_list";
import SubNavDesktop from "../components/SubNavDesktop";
import SubNavMobile from "../components/SubNavMobile";
import { useI18n } from "@/i18n/I18nProvider.jsx";

import "./Subheader.css";

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
        "subheader sticky top-16 z-30 backdrop-blur transition-colors",
        className
      )}
    >
      <div className="subheader__inner">
        {title ? <h1 className="subheader__title">{title}</h1> : null}

        <SubNavDesktop tabs={tabs} onTabSelect={onTabSelect} title={title} />
        <SubNavMobile tabs={tabs} onTabSelect={onTabSelect} />
      </div>
    </div>
  );
}
