// src/components/layout/Header.jsx
import { Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import useAuth from "../../hooks/useAuth";
import { useStore } from "../../store/StoreProvider";
import { setTab, openMobile } from "../../store/actions";

export default function Header() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  
  const store = useStore();
  const dispatch = store?.dispatch ?? store?.[1];
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
    <header className="sticky w-screen top z-40 flex h-16 items-center  border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="mx-auto w-full">
        <div className="flex h-16 items-center justify-between">
          {/* Left: mobile hamburger + logo */}
          <div className="flex items-end b-0 gap-4">
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-gray-700"
              onClick={handleMenuClick}
              aria-label="Ouvrir le menu"
              >
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
            {/* Nav modules desktop */}
            <div className="hidden md:flex items-center h-8">
              <Logo className="max-h-full w-auto" />
            </div>
            {/* Nav modules desktop */}
            <HeaderNav />
          </div>{" "}
          <div className="flex md:hidden items-center h-8">
            <Logo className="max-h-full w-auto" />
          </div>
          {/* Right: menu utilisateur (factorisé) */}
          <div className="flex items-center justify-end gap-x-4 lg:gap-x-6">
            <UserMenu
              username={username}
              onGoSettings={handleGoSettings}
              onSignOut={handleSignOut}
              />
          </div>
        </div>
      </div>
    </header>
  );
}

import HeaderNav from "./components/HeaderNav";
import Logo from "../common/LogoLong.jsx";
import UserMenu from "./components/UserMenu.jsx";