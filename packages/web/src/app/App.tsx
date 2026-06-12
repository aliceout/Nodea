import { lazy, Suspense, useEffect, type ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from '@/ui/layout/Layout';
import ProtectedRoute from '@/core/auth/ProtectedRoute';
import { ErrorBoundary } from '@/ui/atoms/feedback/ErrorBoundary';
import { ConfirmProvider } from '@/ui/dirk/confirm/ConfirmProvider';
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
const Terms = lazy(() => import('./pages/Terms'));
const Changelog = lazy(() => import('./pages/Changelog'));

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
      const state = e.state as
        | { nodeaModule?: unknown; scrollY?: unknown }
        | null;
      const id = state?.nodeaModule;
      const next = isModuleId(id) ? id : 'home';
      useNodeaStore.getState().syncCurrentModule(next);
      // Restore scroll position stamped on the entry by `setModule`
      // (FRONT-06). Defer one frame so React has rendered the
      // restored module — otherwise the page may not yet be tall
      // enough for the target scrollY.
      const scrollY = typeof state?.scrollY === 'number' ? state.scrollY : 0;
      window.requestAnimationFrame(() => {
        window.scrollTo({ top: scrollY, behavior: 'instant' });
      });
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
      {/* Public docs : 3 sections (security / contribute / self-host).
          - /docs/security/{newbie,advanced,tech} — modèle de sécu en
            3 tiers de lecture.
          - /docs/fork — reprendre le projet pour soi.
          - /docs/self-host — auto-héberger une instance.
          /docs (no path) redirige sur la section par défaut. Une
          :section invalide est détectée dans <Docs/> et fallback
          aussi sur security/newbie. Per-section URLs permettent les
          deep-links et les anchors h2/h3 (#section-id). Le `/flow`
          privacy invariant ne s'applique pas ici — /docs est public.
          Les anciennes URLs (/docs/newbie etc.) sont redirigées
          vers /docs/security/<tier> pour ne pas casser les liens
          publiés. */}
      <Route path="/docs" element={<Navigate to="/docs/security/newbie" replace />} />
      <Route path="/docs/newbie" element={<Navigate to="/docs/security/newbie" replace />} />
      <Route path="/docs/advanced" element={<Navigate to="/docs/security/advanced" replace />} />
      <Route path="/docs/tech" element={<Navigate to="/docs/security/tech" replace />} />
      <Route path="/docs/security" element={<Navigate to="/docs/security/newbie" replace />} />
      <Route path="/docs/:section" element={lazyPage(<Docs />)} />
      <Route path="/docs/:section/:tier" element={lazyPage(<Docs />)} />
      {/* Public legal page. CGU brouillon — la V1 juridique remplacera
          le source dans `pages/Terms/content.md`. Lien depuis le footer
          de Login. */}
      <Route path="/terms" element={lazyPage(<Terms />)} />
      {/* Auto-generated release notes (issue #91). Public route ;
          content lives in `pages/Changelog/content.md`, regenerated
          from `git log` between `v*` tags by
          `scripts/generate-changelog.ts`. */}
      <Route path="/changelog" element={lazyPage(<Changelog />)} />
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
      <ConfirmProvider>
        <AppWithKeyModal />
      </ConfirmProvider>
    </BrowserRouter>
  );
}
