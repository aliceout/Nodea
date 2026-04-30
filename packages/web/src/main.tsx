import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { I18nProvider } from '@/i18n/I18nProvider.jsx';
import { ErrorBoundary } from '@/ui/atoms/feedback/ErrorBoundary';
import { applyTheme } from '@/core/theme/themeManager';
import '@/ui/theme/index.css';

import App from '@/app/App.tsx';

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
