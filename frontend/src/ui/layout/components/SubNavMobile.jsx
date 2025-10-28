import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { EllipsisVerticalIcon } from "@heroicons/react/24/outline";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function SubNavMobile({ tabs = [], onTabSelect }) {
  const { t } = useI18n();
  if (!tabs.length) return null;

  const ariaLabel = t("layout.subnav.mobileMenuLabel", {
    defaultValue: "Liens de la section",
  });

  return (
    // visible seulement en mobile ; collǸ �� droite
    <div className="md:hidden ml-auto">
      <Menu as="div" className="relative">
        <MenuButton
          type="button"
          className="inline-flex items-center justify-center"
          aria-label={ariaLabel}
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
          {tabs.map((tab) => {
            const label = tab.label
              ? t(tab.label, { defaultValue: tab.label })
              : "";
            return (
              <MenuItem key={tab.id}>
                {({ focus }) => (
                  <button
                    type="button"
                    onClick={() => onTabSelect?.(tab.id)}
                    className={`block w-full px-3 py-1.5 text-left text-sm ${
                      focus ? "bg-gray-50" : ""
                    } ${tab.active ? "font-semibold" : ""}`}
                  >
                    {label}
                  </button>
                )}
              </MenuItem>
            );
          })}
        </MenuItems>
      </Menu>
    </div>
  );
}
