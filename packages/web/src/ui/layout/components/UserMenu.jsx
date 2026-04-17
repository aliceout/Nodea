import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import UserAvatar from "../components/UserAvatar";
import pb from "@/core/api/pocketbase";
import { useStore } from "@/core/store/StoreProvider";
import { setTab } from "@/core/store/actions";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function UserMenu({
  username,
  onGoAccount = () => {},
  onGoSettings = () => {},
  onSignOut = () => {},
}) {
  const user = pb.authStore.model;
  const isAdmin = user?.role === "admin";
  const { dispatch } = useStore();
  const { t } = useI18n();
  const displayName = username || t("layout.header.defaultUsername");

  return (
    <Menu as="div" className="relative">
      <MenuButton className="relative flex items-center">
        <span className="sr-only">{t("layout.userMenu.open")}</span>
        <UserAvatar seed={displayName} size={32} />
        <span className="hidden lg:flex lg:items-center">
          <span className="ml-4 text-sm font-semibold text-gray-900">
            {displayName}
          </span>
          <ChevronDownIcon
            aria-hidden="true"
            className="ml-2 size-5 text-gray-400"
          />
        </span>
      </MenuButton>

      <MenuItems
        transition
        className="absolute right-0 z-50 mt-2.5 w-44 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75"
      >
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onGoAccount}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              {t("layout.userMenu.profile")}
            </button>
          )}
        </MenuItem>
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onGoSettings}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              {t("layout.userMenu.settings")}
            </button>
          )}
        </MenuItem>
        {isAdmin && (
          <MenuItem>
            {({ focus }) => (
              <button
                type="button"
                onClick={() => dispatch(setTab("admin"))}
                className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                  focus ? "bg-gray-50" : ""
                }`}
              >
                {t("layout.userMenu.admin")}
              </button>
            )}
          </MenuItem>
        )}
        <MenuItem>
          {({ focus }) => (
            <button
              type="button"
              onClick={onSignOut}
              className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                focus ? "bg-gray-50" : ""
              }`}
            >
              {t("layout.userMenu.signOut")}
            </button>
          )}
        </MenuItem>
      </MenuItems>
    </Menu>
  );
}
