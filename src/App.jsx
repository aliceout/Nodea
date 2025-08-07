import React from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ProtectedRoute from "./components/common/ProtectedRoute";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Form from "./modules/Mood/Form";
import History from "./modules/Mood/History";
import Graph from "./modules/Mood/Graph";
import Admin from "./pages/Admin";
import Account from "./pages/Account";
import NotFound from "./pages/NotFound";
import ChangePasswordPage from "./pages/ChangePassword";

import Navbar from "./components/layout/navbar/Navbar";

// Tableau de routes protégées
const protectedRoutes = [
  { path: "/journal", element: <Form /> },
  { path: "/history", element: <History /> },
  { path: "/graph", element: <Graph /> },
  { path: "/account", element: <Account /> },
  { path: "/change-password", element: <ChangePasswordPage /> },
  { path: "/admin", element: <Admin />, adminOnly: true },
];

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
            {/* Routes protégées via mapping */}
            {protectedRoutes.map(({ path, element, adminOnly }) => (
              <Route
                key={path}
                path={path}
                element={
                  <ProtectedRoute adminOnly={adminOnly}>
                    {element}
                  </ProtectedRoute>
                }
              />
            ))}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
