// src/components/layout/Header.jsx
import { Bars3Icon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { useStore } from "../../store/StoreProvider";
import { selectCurrentTab } from "../../store/selectors";
import { setTab, openMobile } from "../../store/actions";
import { nav } from "./Navigation";

import UserAvatar from "./components/UserAvatar";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const store = useStore();
  const state = store?.state ?? store?.[0];
  const dispatch = store?.dispatch ?? store?.[1];

  const current = selectCurrentTab(state);

  // Titre basé sur la nav + l’onglet courant
  const title = useMemo(() => {
    return nav.find((t) => t.id === current)?.title ?? "";
  }, [current]);

  const username = user?.username || "Utilisateur·rice";

  const handleMenuClick = () => dispatch(openMobile());
  const handleGoSettings = () => dispatch(setTab("settings"));
  const handleSignOut = async () => {
    try {
      await logout();
    } finally {
      navigate("/login", { replace: true });
    }
  };

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 items-center justify-between">
          {/* Left: mobile hamburger + titre */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-gray-700"
              onClick={handleMenuClick}
              aria-label="Ouvrir le menu"
            >
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
          </div>

          {/* Right: menu utilisateur */}
          <div className="flex items-center justify-end gap-x-4 lg:gap-x-6">
            <Menu as="div" className="relative">
              <MenuButton className="relative flex items-center">
                <span className="sr-only">Ouvrir le menu utilisateur</span>
                <UserAvatar seed={username} size={32} />
                <span className="hidden lg:flex lg:items-center">
                  <span className="ml-4 text-sm font-semibold text-gray-900">
                    {username}
                  </span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className="ml-2 size-5 text-gray-400"
                  />
                </span>
              </MenuButton>

              <MenuItems
                transition
                className="absolute right-0 z-10 mt-2.5 w-44 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 data-closed:scale-95 data-closed:opacity-0 data-enter:duration-100 data-leave:duration-75"
              >
                <MenuItem>
                  {({ focus }) => (
                    <button
                      type="button"
                      onClick={handleGoSettings}
                      className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                        focus ? "bg-gray-50" : ""
                      }`}
                    >
                      Votre profil
                    </button>
                  )}
                </MenuItem>
                <MenuItem>
                  {({ focus }) => (
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className={`block w-full px-3 py-1.5 text-left text-sm text-gray-900 ${
                        focus ? "bg-gray-50" : ""
                      }`}
                    >
                      Déconnexion
                    </button>
                  )}
                </MenuItem>
              </MenuItems>
            </Menu>
          </div>
        </div>
      </div>
    </header>
  );
}
