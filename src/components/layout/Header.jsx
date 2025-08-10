// src/components/layout/Header.jsx
import { Bars3Icon } from "@heroicons/react/24/outline";
import { ChevronDownIcon } from "@heroicons/react/20/solid";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";
import BoringAvatar from "boring-avatars";

export default function Header({ onMenuClick, onSignOut = () => {} }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Username obligatoire
  const username = user?.username || "Utilisateur·rice";

  return (
    <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center gap-x-4 border-b border-gray-200 bg-white px-4 shadow-sm sm:gap-x-6 sm:px-6 lg:px-8">
      {/* Bouton menu mobile */}
      <button
        type="button"
        onClick={onMenuClick}
        className="-m-2.5 p-2.5 text-gray-700 hover:text-gray-900 lg:hidden"
      >
        <span className="sr-only">Ouvrir le menu</span>
        <Bars3Icon className="size-6" aria-hidden="true" />
      </button>

      {/* Espace à droite */}
      <div className="flex flex-1 items-center justify-end gap-x-4 lg:gap-x-6">
        {/* Menu utilisateur */}
        <Menu as="div" className="relative">
          <MenuButton className="relative flex items-center">
            <span className="sr-only">Ouvrir le menu utilisateur</span>

            {/* Avatar généré */}
            <BoringAvatar
              size={32}
              name={username}
              variant="beam"
              colors={["#92A1C6", "#146A7C", "#F0AB3D", "#C271B4", "#C20D90"]}
            />

            <span className="hidden lg:flex lg:items-center">
              <span
                aria-hidden="true"
                className="ml-4 text-sm font-semibold text-gray-900"
              >
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
            className="absolute right-0 z-10 mt-2.5 w-44 origin-top-right rounded-md bg-white py-2 shadow-lg outline-1 outline-gray-900/5 transition"
          >
            <MenuItem>
              {({ focus }) => (
                <button
                  type="button"
                  onClick={() => navigate("/flow?tab=settings")}
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
                  onClick={onSignOut}
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
    </header>
  );
}
