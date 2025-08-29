import { Navigate } from "react-router-dom";
import pb from "../services/pocketbase";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const user = pb.authStore.model;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== "admin") {
    return <Navigate to="/journal" replace />;
  }

  return children;
}
