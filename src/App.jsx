import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import JournalForm from "./pages/JournalForm";
import History from "./pages/History";
import Graph from "./pages/Graph";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import ChangePasswordPage from "./pages/ChangePassword";

import Navbar from "./components/Navbar/Navbar";

function App() {
  return (
    <Router>
      <div className="min-h-screen flex flex-col bg-gray-50">
        <Navbar />
        <div className="flex-1 flex flex-col">
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              path="/journal"
              element={
                <ProtectedRoute>
                  <JournalForm />
                </ProtectedRoute>
              }
            />
            <Route
              path="/history"
              element={
                <ProtectedRoute>
                  <History />
                </ProtectedRoute>
              }
            />
            <Route
              path="/graph"
              element={
                <ProtectedRoute>
                  <Graph />
                </ProtectedRoute>
              }
            />
            <Route
              path="/account"
              element={
                <ProtectedRoute>
                  <Account />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute adminOnly={true}>
                  <Admin />
                </ProtectedRoute>
              }
            />
            {/* À ajouter pour la page changement de mot de passe */}
            <Route
              path="/change-password"
              element={
                <ProtectedRoute>
                  {/* Importe et mets ici ton composant ChangePasswordPage */}
                  <ChangePasswordPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
