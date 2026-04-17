import { useMemo } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import KeyMissingModal from '@/ui/atoms/specifics/KeyMissingModal.jsx';
import { nav } from './navigation/Navigation';
import {
  useNodeaStore,
  selectKeyStatus,
} from '@/core/store/nodea-store';
import { useSession } from '@/core/auth/use-session';
import Header from './headers/Header';
import Sidebar from './navigation/Sidebar.jsx';

/**
 * Main authenticated layout.
 *
 * Drops every legacy dependency:
 *   - `useAuth` (PB authStore) → `useSession`
 *   - `useStore` (reducer + Context) → `useNodeaStore`
 *   - `useBootstrapModulesRuntime` (PB-driven runtime config) →
 *     Settings/ModulesManager populates the Zustand `modules` slice
 *     now.
 *   - Onboarding flow → parked (was PB-specific; will come back as a
 *     dedicated feature with a proper design).
 *
 * If the Zustand crypto slice reports `status === 'missing'`
 * (page reload loses the main key even when the session cookie
 * persists), the blocking `KeyMissingModal` is rendered — the only
 * escape is logout + fresh login, which re-derives the main key
 * from the user's password.
 */
export default function Layout() {
  const { moduleId } = useParams();
  const current = moduleId ?? 'home';
  const keyStatus = useNodeaStore(selectKeyStatus);
  const session = useSession();

  const moduleKnown = useMemo(() => nav.some((t) => t.id === current), [current]);
  const ActiveView = useMemo(() => {
    return nav.find((t) => t.id === current)?.element ?? null;
  }, [current]);

  if (!moduleKnown) {
    return <Navigate to="/flow/home" replace />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex transition-colors">
      {keyStatus === 'missing' ? (
        <KeyMissingModal
          onLogout={() => {
            void session.logout();
            window.location.href = '/login';
          }}
        />
      ) : null}

      <Sidebar />
      <div className="flex flex-col flex-1 bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header />
        <main className="flex-1 bg-white dark:bg-slate-900 transition-colors">{ActiveView}</main>
      </div>
    </div>
  );
}
