import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/ui/layout/Layout';
import ProtectedRoute from '@/core/auth/ProtectedRoute';
import { ErrorBoundary } from '@/ui/atoms/feedback/ErrorBoundary';
import { useNodeaStore, isModuleId } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import NotFound from './pages/NotFound';

// Auth pages are lazy-loaded so their deps (react-hook-form, zod,
// @zxcvbn-ts, OPAQUE wasm) stay out of the initial chunk.
const Login = lazy(() => import('./pages/Login'));
const LoginMfa = lazy(() => import('./pages/LoginMfa'));
const Register = lazy(() => import('./pages/Register'));
const Activate = lazy(() => import('./pages/Activate'));
const ChangePassword = lazy(() => import('./pages/ChangePassword'));
const RequestReset = lazy(() => import('./pages/RequestReset'));
const Reset = lazy(() => import('./pages/Reset'));
const RecoveryCode = lazy(() => import('./pages/RecoveryCode'));
const Recover = lazy(() => import('./pages/Recover'));
const Passkeys = lazy(() => import('./pages/Passkeys'));
const Totp = lazy(() => import('./pages/Totp'));
const SecurityMode = lazy(() => import('./pages/SecurityMode'));
const BypassConfirm = lazy(() => import('./pages/BypassConfirm'));
const Docs = lazy(() => import('./pages/Docs'));

function lazyPage(node: ReactElement): ReactElement {
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
  const { t } = useI18n();
  // Back/forward navigation listener. The privacy invariant is that
  // `/flow` is the *only* URL the server ever sees while a user is in
  // the app — but the browser's history API still tracks navigation
  // via the per-entry `state` payload, which never leaves the client.
  // `setModule` in the store writes `{ nodeaModule: id }` into each
  // pushed entry ; here we read it back on `popstate` and sync the
  // store so the back button restores the previous module without
  // changing the URL.
  useEffect(() => {
    function handler(e: PopStateEvent): void {
      const state = e.state as { nodeaModule?: unknown } | null;
      const id = state?.nodeaModule;
      const next = isModuleId(id) ? id : 'home';
      useNodeaStore.getState().syncCurrentModule(next);
    }
    window.addEventListener('popstate', handler);
    return () => window.removeEventListener('popstate', handler);
  }, []);

  return (
    <>
      {/* Skip-link a11y : first focusable element on every page so a
          keyboard / screen-reader user can jump past the marketing
          panel + nav and land directly on the main content. Visually
          hidden until focused (Tailwind sr-only / focus:not-sr-only). */}
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-bg focus:px-3 focus:py-2 focus:text-ink focus:shadow-[0_0_0_2px_var(--color-k-accent)] focus:outline-none"
      >
        {t('common.a11y.skipToMain')}
      </a>
      <Routes>
      <Route path="/" element={<Navigate to="/flow" replace />} />
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
      {/* Public docs : /docs/:tab where tab ∈ { newbie, advanced, tech }.
          /docs (no tab) redirects to the default tier (newbie). An
          invalid :tab is detected inside <Docs/> and falls back to
          newbie too. Per-tab URLs let pasted links land on the right
          tier and let h2/h3 anchors be deep-linked (#section-id).
          The /flow privacy invariant doesn't apply here — /docs is
          public, no leak concern. */}
      <Route path="/docs" element={<Navigate to="/docs/newbie" replace />} />
      <Route path="/docs/:tab" element={lazyPage(<Docs />)} />
      <Route
        path="/flow"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      />
      {/* Catch-all under /flow — old `/flow/<module>` bookmarks land
          here and get redirected to the canonical `/flow`. The store
          decides which module to show ; the URL never reveals it. */}
      <Route path="/flow/*" element={<Navigate to="/flow" replace />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppWithKeyModal />
    </BrowserRouter>
  );
}
