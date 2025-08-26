import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";

export default function SubNavMobile({ tabs = [], onTabSelect }) {
  if (!tabs.length) return null;

  return (
    // visible seulement en mobile ; collé à droite
    <div className="md:hidden ml-auto">
      <Menu as="div" className="relative">
        <MenuButton
          type="button"
          className="inline-flex items-center justify-center"
          aria-label="Liens de la section"
        >
          <EllipsisVerticalIcon className="h-6 w-6" aria-hidden="true" />
        </MenuButton>

        <MenuItems
          transition
          className="absolute right-0 z-50 mt-2.5 w-56 origin-top-right
                     rounded-md bg-white py-2 shadow-lg
                     outline-1 outline-gray-900/5
                     data-closed:scale-95 data-closed:opacity-0
                     data-enter:duration-100 data-leave:duration-75"
        >
          {tabs.map((t) => (
            <MenuItem key={t.id}>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => onTabSelect?.(t.id)}
                  className={`block w-full px-3 py-1.5 text-left text-sm ${
                    focus ? "bg-gray-50" : ""
                  } ${t.active ? "font-semibold" : ""}`}
                >
                  {t.label}
                </button>
              )}
            </MenuItem>
          ))}
        </MenuItems>
      </Menu>
    </div>
  );
}
