import Layout from "@/ui/layout/Layout";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ChangePassword from "./pages/ChangePassword";
import NotFound from "./pages/NotFound";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
// Utilise maintenant la version centralisée dans core/auth
import ProtectedRoute from "@/core/auth/ProtectedRoute";
import { StoreProvider } from "@/core/store/StoreProvider";

// Flux fonctionnels (anciennement "features")
import Admin from "./flow/Admin";
import Homepage from "./flow/Homepage";
import Mood from "./flow/Mood";
import Passage from "./flow/Passage";
import Goals from "./flow/Goals";
import Account from "./flow/Account";
import Settings from "./flow/Settings";

function AppWithKeyModal() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/flow/home" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route
        path="/flow"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="home" element={<Homepage />} />
        <Route path="mood/*" element={<Mood />} />
        <Route path="passage/*" element={<Passage />} />
        <Route path="goals/*" element={<Goals />} />
        <Route path="account/*" element={<Account />} />
        <Route path="settings/*" element={<Settings />} />
        <Route
          path="admin"
          element={
            <ProtectedRoute adminOnly>
              <Admin />
            </ProtectedRoute>
          }
        />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <StoreProvider>
        <AppWithKeyModal />
      </StoreProvider>
    </BrowserRouter>
  );
}
