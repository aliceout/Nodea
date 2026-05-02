import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@/i18n/I18nProvider.jsx';
import { ErrorBoundary } from '@/ui/atoms/feedback/ErrorBoundary';
import { applyTheme } from '@/core/theme/themeManager';
import { initSentryWeb } from '@/sentry';
import '@/ui/theme/index.css';

import App from '@/app/App.tsx';

// Initialise Sentry (no-op when VITE_SENTRY_DSN is unset). Done
// here at import time so unhandled errors fired during the early
// theme setup or React mount are captured too.
initSentryWeb();

// Core Web Vitals — log to console in dev only (FRONT-03).
// Lazy import so the lib (~3 KB gzip) never lands in the prod
// bundle. The dynamic import is tree-shaken away by Vite when
// `import.meta.env.DEV` is statically false at build time.
if (import.meta.env.DEV) {
  void import('web-vitals').then(({ onCLS, onINP, onLCP, onFCP, onTTFB }) => {
    const log = (m: { name: string; value: number; rating: string }) =>
      console.info(`[web-vitals] ${m.name}=${m.value.toFixed(2)} (${m.rating})`);
    onCLS(log);
    onINP(log);
    onLCP(log);
    onFCP(log);
    onTTFB(log);
  });
}

// Apply the theme before React mounts so the initial paint uses the
// right palette. The subsequent state management lives in `useTheme`.
(() => {
  let initial: 'light' | 'dark' | 'system' = 'system';
  try {
    const v = window.localStorage.getItem('nodea:theme');
    if (v === 'light' || v === 'dark' || v === 'system') initial = v;
  } catch {
    // localStorage can throw in private browsing / cookies-disabled
    // mode. Fall through with the `system` default — the user just
    // doesn't get their theme persisted across sessions.
  }
  applyTheme(initial);
})();

const root = document.getElementById('root');
if (!root) throw new Error('Missing #root element');

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <I18nProvider>
        <App />
      </I18nProvider>
    </ErrorBoundary>
  </StrictMode>,
);
