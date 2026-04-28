import { lazy, Suspense } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/ui/layout/Layout";
import ProtectedRoute from "@/core/auth/ProtectedRoute";
import { ErrorBoundary } from "@/ui/atoms/feedback/ErrorBoundary";
import NotFound from "./pages/NotFound";

// Auth pages are lazy-loaded so their deps (react-hook-form, zod,
// @zxcvbn-ts, OPAQUE wasm) stay out of the initial chunk.
const Login = lazy(() => import("./pages/Login"));
const LoginMfa = lazy(() => import("./pages/LoginMfa"));
const Register = lazy(() => import("./pages/Register"));
const Activate = lazy(() => import("./pages/Activate"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const RequestReset = lazy(() => import("./pages/RequestReset"));
const Reset = lazy(() => import("./pages/Reset"));
const RecoveryCode = lazy(() => import("./pages/RecoveryCode"));
const Recover = lazy(() => import("./pages/Recover"));
const Passkeys = lazy(() => import("./pages/Passkeys"));
const Totp = lazy(() => import("./pages/Totp"));
const SecurityMode = lazy(() => import("./pages/SecurityMode"));
const BypassConfirm = lazy(() => import("./pages/BypassConfirm"));
const Docs = lazy(() => import("./pages/Docs"));

function lazyPage(node) {
  return (
    <ErrorBoundary>
      <Suspense
        fallback={<div className="p-6 text-center opacity-60">Chargement…</div>}
      >
        {node}
      </Suspense>
    </ErrorBoundary>
  );
}

function AppWithKeyModal() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/flow/home" replace />} />
      <Route path="/login" element={lazyPage(<Login />)} />
      <Route path="/login/mfa" element={lazyPage(<LoginMfa />)} />
      <Route path="/register" element={lazyPage(<Register />)} />
      <Route path="/activate" element={lazyPage(<Activate />)} />
      <Route path="/change-password" element={lazyPage(<ChangePassword />)} />
      <Route path="/request-reset" element={lazyPage(<RequestReset />)} />
      <Route path="/reset" element={lazyPage(<Reset />)} />
      <Route path="/recovery-code" element={lazyPage(<RecoveryCode />)} />
      <Route path="/recover" element={lazyPage(<Recover />)} />
      <Route path="/passkeys" element={lazyPage(<Passkeys />)} />
      <Route path="/totp" element={lazyPage(<Totp />)} />
      <Route path="/security-mode" element={lazyPage(<SecurityMode />)} />
      <Route path="/auth/bypass/confirm" element={lazyPage(<BypassConfirm />)} />
      <Route path="/docs" element={lazyPage(<Docs />)} />
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
