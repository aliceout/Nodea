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
import Sidebar from '@/ui/dirk/Sidebar';

/**
 * Direction K shell — fixed sidebar (240px) on `lg+`, slide-in
 * drawer below. The previous Header / Subheader pair is gone:
 * each page renders its own per-page topbar inside the main
 * column to keep the visual rhythm of the handoff (per-page
 * dates, page-level CTAs, custom hierarchies).
 *
 * Crypto status `missing` keeps blocking with `KeyMissingModal`.
 * Pending onboarding still overlays `OnboardingModal` on top of
 * the current route.
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
    <div className="flex min-h-screen bg-bg text-ink">
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
      <main className="flex min-w-0 flex-1 flex-col">{ActiveView}</main>
    </div>
  );
}
