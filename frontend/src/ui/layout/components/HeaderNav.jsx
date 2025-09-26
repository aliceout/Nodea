// src/components/layout/components/ModuleNav.jsx
import { MODULES } from "@/app/config/modules_list";
import { useStore } from "@/core/store/StoreProvider";
import { selectCurrentTab } from "@/core/store/selectors";
import { setTab } from "@/core/store/actions";

import {
  useModulesRuntime,
  isModuleEnabled,
} from "@/core/store/modulesRuntime";

export default function HeadearNav() {
  const { state, dispatch } = useStore();
  const current = selectCurrentTab(state);
  const modulesRuntime = useModulesRuntime();

  // On ne montre que les modules marqués display=true
  const visibleNav = (MODULES || []).filter((i) => {
    if (i.display === false) return false;
    if (!i.to_toggle) return true;
    return isModuleEnabled(modulesRuntime, i.id);
  });
  return (
    <nav className="hidden lg:block ml-4">
      <ul className="flex items-start justify-end gap-5 group">
        {visibleNav.map((item) => (
          <li key={item.id} className="relative group/item">
            <button
              type="button"
              onClick={() => dispatch(setTab(item.id))}
              className="flex flex-col items-center group/nav px-1 "
              aria-current={current === item.id ? "page" : undefined}
            >
              {item.icon ? (
                <item.icon
                  className={`transition-all duration-150 h-6 w-6 ${
                    current === item.id
                      ? "text-nodea-sage"
                      : "text-nodea-sage-dark"
                  }  group-hover:mb-1 group-hover/nav:text-nodea-sage-light`}
                />
              ) : null}
              <span
                className={`absolute top-6 text-[10px] leading-none opacity-0 group-hover:opacity-100 transition-opacity ${
                  current === item.id
                    ? "text-nodea-sage"
                    : "text-nodea-sage-dark"
                } group/nav-hover:text-nodea-sage-light`}
              >
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
