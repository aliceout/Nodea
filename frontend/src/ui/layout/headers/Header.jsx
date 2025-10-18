import { Bars3Icon } from "@heroicons/react/24/outline";
import { useNavigate } from "react-router-dom";

import useAuth from "@/core/auth/useAuth";
import { useStore } from "@/core/store/StoreProvider";
import { setTab, openMobile } from "@/core/store/actions";

import HeaderNav from "../components/HeaderNav.jsx";
import Logo from "@/ui/branding/LogoLong.jsx";
import UserMenu from "../components/UserMenu.jsx";

export default function Header() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { dispatch, logout: logoutStore } = useStore();

  const username = user?.username || "Utilisateur.rice";

  const handleMenuClick = () => dispatch(openMobile());
  const handleGoAccount = () => dispatch(setTab("account"));
  const handleGoSettings = () => dispatch(setTab("settings"));
  const handleSignOut = async () => {
    await logoutStore();
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky w-screen top-0 z-40 flex h-16 items-center border-b border-gray-200 bg-white px-4 shadow-sm sm:px-6 lg:px-8">
      <div className="mx-auto w-full">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-end gap-4">
            <button
              type="button"
              className="lg:hidden -m-2.5 p-2.5 text-gray-700"
              onClick={handleMenuClick}
              aria-label="Ouvrir le menu"
            >
              <Bars3Icon aria-hidden="true" className="h-6 w-6" />
            </button>
            <div className="hidden md:flex items-center h-8">
              <Logo className="max-h-full w-auto" />
            </div>
            <HeaderNav />
          </div>
          <div className="flex md:hidden items-center h-8">
            <Logo className="max-h-full w-auto" />
          </div>
          <div className="flex items-center justify-end gap-x-4 lg:gap-x-6">
            <UserMenu
              username={username}
              onGoAccount={handleGoAccount}
              onGoSettings={handleGoSettings}
              onSignOut={handleSignOut}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
