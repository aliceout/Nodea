import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../../hooks/useAuth";
import React, { useEffect } from "react";

export default function Mobile({ menuOpen, setMenuOpen }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Bloque le scroll du body quand menuOpen
  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    // Clean up si unmount
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuOpen]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMenuOpen(false);
  };

  if (!menuOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-sky-900/95 flex flex-col items-center justify-center gap-8 z-40 md:hidden"
      onClick={() => setMenuOpen(false)}
    >
      <Link
        to="/journal"
        className="text-xl"
        onClick={() => setMenuOpen(false)}
      >
        Journal
      </Link>
      <Link
        to="/history"
        className="text-xl"
        onClick={() => setMenuOpen(false)}
      >
        Historique
      </Link>
      {user.role === "admin" && (
        <Link
          to="/admin"
          className="text-xl"
          onClick={() => setMenuOpen(false)}
        >
          Admin
        </Link>
      )}
      <Link
        to="/account"
        className="text-xl mt-5"
        onClick={() => setMenuOpen(false)}
      >
        Mon compte
      </Link>
      <button
        onClick={handleLogout}
        className="bg-gray-200 text-sky-900 px-5 py-2 rounded hover:bg-gray-300"
      >
        Déconnexion
      </button>
    </div>
  );
}
