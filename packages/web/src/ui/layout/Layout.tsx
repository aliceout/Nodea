import { useMemo, useState } from 'react';
import { Navigate, useParams } from 'react-router-dom';
import KeyMissingModal from '@/ui/atoms/specifics/KeyMissingModal';
import OnboardingModal from '@/ui/atoms/specifics/OnboardingModal';
import { nav } from './navigation/Navigation';
import {
  useNodeaStore,
  selectKeyStatus,
  selectUser,
} from '@/core/store/nodea-store';
import { useSession } from '@/core/auth/use-session';
import { apiCompleteOnboarding, apiMe } from '@/core/api/client';
import { usePreferences } from '@/core/preferences/usePreferences';
import { useModulesHydration } from '@/core/modules/useModulesHydration';
import Header from './headers/Header';
import Sidebar from './navigation/Sidebar.jsx';

/**
 * Main authenticated layout.
 *
 * Crypto slice `status === 'missing'` blocks with `KeyMissingModal`
 * (only escape is logout + fresh login, which re-derives the main key).
 *
 * `auth.user.onboardingStatus === 'pending'` overlays `OnboardingModal`
 * on top of the current route — it doesn't block navigation, just asks
 * to pick language / theme / at least one module before letting the
 * user snooze or finalise.
 */
export default function Layout() {
  const { moduleId } = useParams();
  const current = moduleId ?? 'home';
  const keyStatus = useNodeaStore(selectKeyStatus);
  const user = useNodeaStore(selectUser);
  const setAuth = useNodeaStore((s) => s.setAuth);
  const session = useSession();
  // Hydrate the encrypted user preferences + modules-config slices as
  // soon as the layout mounts — each runs at most once per
  // (session, mainKey) pair.
  usePreferences();
  useModulesHydration();
  const [snoozed, setSnoozed] = useState(false);
  const needsOnboarding =
    !snoozed && user?.onboardingStatus === 'pending' && keyStatus !== 'missing';

  async function finishOnboarding(): Promise<void> {
    await apiCompleteOnboarding();
    const me = await apiMe();
    if (me) setAuth(me);
  }

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

      <OnboardingModal
        open={needsOnboarding}
        onFinish={finishOnboarding}
        onSnooze={() => setSnoozed(true)}
      />


      <Sidebar />
      <div className="flex flex-col flex-1 bg-slate-50 dark:bg-slate-950 transition-colors">
        <Header />
        <main className="flex-1 bg-white dark:bg-slate-900 transition-colors">{ActiveView}</main>
      </div>
    </div>
  );
}
