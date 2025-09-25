import Layout from "@/ui/layout/Layout";
import Login from "../pages/Login";
import Register from "../pages/Register";
import ChangePassword from "../pages/ChangePassword";
import NotFound from "../pages/NotFound";

import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "@/components/shared/ProtectedRoute";
import { StoreProvider, useStore } from "../store/StoreProvider";

import Admin from "../features/Admin";

function AppWithKeyModal() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/flow" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/change-password" element={<ChangePassword />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="flow" element={<div />} /> {/* plus de <Content /> */}
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
