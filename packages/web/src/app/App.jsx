import Layout from "@/ui/layout/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/core/auth/ProtectedRoute";

function AppWithKeyModal() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/flow/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route path="/flow" element={<Navigate to="/flow/home" replace />} />
      <Route
        path="/flow/:moduleId"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWithKeyModal />
    </BrowserRouter>
  );
}
