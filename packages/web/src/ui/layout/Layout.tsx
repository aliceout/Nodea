import { useEffect, useMemo } from 'react';
import KeyMissingModal from '@/ui/atoms/specifics/KeyMissingModal';
import { nav } from './navigation/Navigation';
import {
  useNodeaStore,
  selectKeyStatus,
  selectCurrentModule,
} from '@/core/store/nodea-store';
import { useSession } from '@/core/auth/use-session';
import { usePreferences } from '@/core/preferences/usePreferences';
import { useModulesHydration } from '@/core/modules/useModulesHydration';
import { useFirstRunSeed } from '@/core/modules/useFirstRunSeed';
import Sidebar from '@/ui/dirk/Sidebar';
import ComposerModal from '@/ui/dirk/ComposerModal';

/**
 * Direction K shell — fixed sidebar (240px) on `lg+`, slide-in
 * drawer below. The previous Header / Subheader pair is gone:
 * each page renders its own per-page topbar inside the main
 * column to keep the visual rhythm of the handoff (per-page
 * dates, page-level CTAs, custom hierarchies).
 *
 * Crypto status `missing` keeps blocking with `KeyMissingModal`.
 * First-run onboarding now lives inline on the home page (see
 * `app/flow/Homepage/Onboarding.tsx`) — no shell-level modal.
 */
export default function Layout() {
  // The active module lives in the store, not in the URL — see
  // `flow` slice in `nodea-store.ts` and the popstate listener in
  // `App.jsx`. URL stays at `/flow` regardless of which module is
  // active so module-visited metadata never leaks into Nginx /
  // Pino logs.
  const current = useNodeaStore(selectCurrentModule);
  const syncCurrentModule = useNodeaStore((s) => s.syncCurrentModule);
  const keyStatus = useNodeaStore(selectKeyStatus);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const closeComposer = useNodeaStore((s) => s.closeComposer);
  const composerOpen = useNodeaStore((s) => s.composer.open);
  const session = useSession();
  // Hydrate the encrypted user preferences + modules-config slices as
  // soon as the layout mounts — each runs at most once per
  // (session, mainKey) pair. The first-run seed then enables every
  // module by default and flips `onboardingStatus = complete` for
  // brand-new accounts (no picker to confront an uncontextualised
  // user — see `useFirstRunSeed.ts`).
  usePreferences();
  useModulesHydration();
  useFirstRunSeed();

  // ⌘K (or Ctrl+K) toggles the global composer from anywhere in the
  // shell. Disabled when the key is missing — the blocking
  // KeyMissingModal owns input focus until the user re-auths.
  useEffect(() => {
    if (keyStatus === 'missing') return undefined;
    function handleKey(event: KeyboardEvent): void {
      const isComposerHotkey =
        (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k';
      if (!isComposerHotkey) return;
      event.preventDefault();
      if (composerOpen) closeComposer();
      else openComposer();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [keyStatus, composerOpen, openComposer, closeComposer]);

  const moduleKnown = useMemo(() => nav.some((t) => t.id === current), [current]);
  const ActiveView = useMemo(() => {
    // Fall back to home's element when the store points at a module
    // that isn't in the user's enabled set — happens if a module was
    // disabled while the user was on it. The store correction below
    // happens in an effect (no setState during render).
    return (
      nav.find((t) => t.id === current)?.element ??
      nav.find((t) => t.id === 'home')?.element ??
      null
    );
  }, [current]);

  // Self-heal the store when it points at an unknown / disabled module.
  // Uses `syncCurrentModule` (no `pushState`) so we don't add a phantom
  // entry to the back-stack for a fallback the user never asked for.
  useEffect(() => {
    if (!moduleKnown) syncCurrentModule('home');
  }, [moduleKnown, syncCurrentModule]);

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

      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col">{ActiveView}</main>

      <ComposerModal />
    </div>
  );
}
