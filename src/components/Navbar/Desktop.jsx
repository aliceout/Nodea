import { Link, useNavigate } from "react-router-dom";
import useAuth from "../../hooks/useAuth";

export default function Desktop() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="md:px-10 hidden md:flex w-full items-center justify-between">
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
          className="bg-gray-200 text-sky-900 px-3 py-1 rounded hover:bg-gray-300"
        >
          Déconnexion
        </button>
      </div>
    </div>
  );
}
