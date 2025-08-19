// src/components/layout/components/ModuleNav.jsx
import { useStore } from "../../../store/StoreProvider";
import { setTab } from "../../../store/actions";
import { selectCurrentTab } from "../../../store/selectors";
import { nav } from "../Navigation"; // table de modules (home, mood, etc.)

export default function ModuleNav() {
  const { state, dispatch } = useStore();
  const current = selectCurrentTab(state);

  // on limite aux modules principaux (home + mood pour l’instant)
  const modules = nav.filter((m) => m.display);

  return (
    <nav className="hidden lg:block ml-4">
      <ul className="flex items-center justify-end gap-6 group">
        {modules.map((item) => (
          <li key={item.id} className="relative group/item">
            <button
              type="button"
              onClick={() => dispatch(setTab(item.id))}
              className="flex flex-col items-center"
              aria-current={current === item.id ? "page" : undefined}
            >
              <item.icon
                className={`transition-all duration-150 h-6 w-6 ${
                  current === item.id
                    ? "text-nodea-sage"
                    : "text-nodea-sage-dark"
                } group-hover:h-5 group-hover:w-5 group-hover:mb-1`}
              />
              <span className="absolute top-6 text-[10px] leading-none text-nodea-sage-dark opacity-0 group-hover/item:opacity-100 transition-opacity">
                {item.label}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
