import { Link, useNavigate } from "react-router-dom";
import useAuth from "../hooks/useAuth";
import { useState } from "react";

export default function Navbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
    setMenuOpen(false);
  };

  return (
    <nav className="fixed top-0 left-0 w-full z-50 bg-blue-800 text-white pl-20 pr-10 px-4 py-3 flex items-center justify-between">
      {/* Desktop */}
      <div className="hidden md:flex w-full items-center justify-between">
        {/* Liens à gauche */}
        <div className="flex items-center gap-6">
          <Link to="/journal" className="hover:underline">
            Journal
          </Link>
          <Link to="/history" className="hover:underline">
            Historique
          </Link>
          <Link to="/graph" className="hover:underline">
            Graphique
          </Link>
          {user.role === "admin" && (
            <Link to="/admin" className="hover:underline">
              Admin
            </Link>
          )}
        </div>
        {/* User + bouton à droite */}
        <div className="flex items-center gap-6">
          <span className="italic">{user.username || user.email}</span>
          <Link to="/account" className="hover:underline">
            Mon compte
          </Link>
          <button
            onClick={handleLogout}
            className="bg-gray-200 text-blue-900 px-3 py-1 rounded hover:bg-gray-300"
          >
            Déconnexion
          </button>
        </div>
      </div>
      {/* Mobile hamburger */}
      <button
        className="md:hidden flex flex-col justify-center items-center w-12 h-12 z-50"
        onClick={() => setMenuOpen(!menuOpen)}
        aria-label="Ouvrir le menu"
      >
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
          <rect y="5" width="24" height="3" rx="1.5" fill="white" />
          <rect y="11" width="24" height="3" rx="1.5" fill="white" />
          <rect y="17" width="24" height="3" rx="1.5" fill="white" />
        </svg>
      </button>
      {/* Overlay menu mobile */}
      {menuOpen && (
        <div
          className="fixed inset-0 bg-blue-900/95 flex flex-col items-center justify-center gap-8 z-40 md:hidden"
          onClick={() => setMenuOpen(false)}
        >
          <Link
            to="/journal"
            className="text-2xl"
            onClick={() => setMenuOpen(false)}
          >
            Journal
          </Link>
          <Link
            to="/history"
            className="text-2xl"
            onClick={() => setMenuOpen(false)}
          >
            Historique
          </Link>
          <Link
            to="/graph"
            className="text-2xl"
            onClick={() => setMenuOpen(false)}
          >
            Graphique
          </Link>
          {user.role === "admin" && (
            <Link
              to="/admin"
              className="text-2xl"
              onClick={() => setMenuOpen(false)}
            >
              Admin
            </Link>
          )}
          <div className="mt-2 text-base italic">
            {user.username || user.email}
          </div>
          <div>
            <Link
              to="/account"
              className="text-2xl"
              onClick={() => setMenuOpen(false)}
            >
              Mon compte
            </Link>
            <button
              onClick={handleLogout}
              className="bg-gray-200 text-blue-900 px-5 py-2 rounded hover:bg-gray-300"
            >
              Déconnexion
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}
