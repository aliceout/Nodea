import { Navigate, Outlet, useLocation } from "react-router-dom";
import useAuth from "./useAuth";
import { useStore } from "../store/StoreProvider";

/**
 * Route protégée
 * - Redirige vers /login si pas d'utilisateur
 * - Gère option adminOnly
 * - Fournit un Outlet pour enfant
 */
export default function ProtectedRoute({ adminOnly = false, children }) {
  const { user } = useAuth();
  const { mainKey } = useStore();
  const location = useLocation();

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/flow" replace />;
  }

  // (Optionnel) on pourrait forcer la présence de la mainKey si nécessaire
  // if(!mainKey) { ... } => géré ailleurs via modales spécifiques.

  if (children) return children;
  return <Outlet />;
}
