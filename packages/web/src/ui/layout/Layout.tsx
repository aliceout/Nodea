import { useEffect, useMemo } from 'react';
import { nav } from './navigation/Navigation';
import {
  useNodeaStore,
  selectKeyStatus,
  selectCurrentModule,
} from '@/core/store/nodea-store';
import { useSession } from '@/core/auth/use-session';
import { usePreferences } from '@/core/auth/use-preferences';
import { useModulesHydration } from '@/core/modules/useModulesHydration';
import { useFirstRunSeed } from '@/core/modules/useFirstRunSeed';
import { useAutoCloudBackup } from '@/app/flow/Account/views/data/useAutoCloudBackup';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Sidebar from '@/ui/dirk/Sidebar';

/**
 * Direction K shell — fixed sidebar (240px) on `lg+`, slide-in
 * drawer below. The previous Header / Subheader pair is gone:
 * each page renders its own per-page topbar inside the main
 * column to keep the visual rhythm of the handoff (per-page
 * dates, page-level CTAs, custom hierarchies).
 *
 * Crypto status `missing` (valid session cookie but no in-memory key —
 * e.g. a page reload) signs the user out and redirects to
 * `/login?session-lost=1`, where a red banner asks them to sign in
 * again. (Previously a blocking in-app modal ; the redirect is clearer
 * and gets the keyless shell off screen.)
 * First-run onboarding is now a silent seed — no picker, no modal :
 * `core/modules/useFirstRunSeed.ts` turns every toggleable module on
 * by default on the first login. (The old inline `Onboarding.tsx`
 * picker was removed with that change.)
 *
 * Each module owns its own inline « + Nouvel … » form ; the
 * former shell-level Composer (modal + ⌘K hotkey) is gone. The
 * shortcut is reserved for a future global command palette.
 */
export default function Layout() {
  // The active module lives in the store, not in the URL — see
  // `flow` slice in `nodea-store.ts` and the popstate listener in
  // `App.jsx`. URL stays at `/flow` regardless of which module is
  // active so module-visited metadata never leaks into Nginx /
  // Pino logs.
  const { t } = useI18n();
  const current = useNodeaStore(selectCurrentModule);
  const syncCurrentModule = useNodeaStore((s) => s.syncCurrentModule);
  const keyStatus = useNodeaStore(selectKeyStatus);
  const session = useSession();
  const sessionLost = keyStatus === 'missing';

  // Lost in-memory key → sign out and bounce to /login with a banner.
  // `session.logout()` purges the server session, then does its own
  // `location.replace()`; we deliberately don't navigate in parallel —
  // that would cancel the in-flight purge and leave the cookie valid on
  // a shared computer (audit 2026-06). Fires once when the key goes
  // missing (guarded by the boolean), never on unrelated re-renders.
  useEffect(() => {
    if (!sessionLost) return;
    void session.logout('/login?session-lost=1');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionLost]);
  // Hydrate the encrypted user preferences + modules-config slices as
  // soon as the layout mounts — each runs at most once per
  // (session, mainKey) pair. The first-run seed then enables every
  // module by default and flips `onboardingStatus = complete` for
  // brand-new accounts (no picker to confront an uncontextualised
  // user — see `useFirstRunSeed.ts`).
  usePreferences();
  useModulesHydration();
  useFirstRunSeed();
  // Auto cloud backup (ADR-0017): on unlock, push a fresh .age if the last is
  // > 24 h old. No-op unless Dropbox is connected; waits for the modules
  // config to hydrate so it never overwrites the rolling file with a partial
  // account.
  useAutoCloudBackup();

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
    <>
      {/* Print guardrail (see ui/theme/print.css) : on screen this is
          hidden ; when the user prints, the protected shell below is
          blanked and only this notice spools to the printer, so the
          decrypted surface never lands on paper / a print-to-PDF
          driver by accident. */}
      <div className="nodea-print-notice" aria-hidden="true">
        Nodea — le contenu chiffré est masqué à l’impression pour votre
        confidentialité. / Encrypted content is hidden from print for your
        privacy.
      </div>
      {sessionLost ? (
        // Key missing → the effect above is signing the user out and
        // redirecting to /login. Show a minimal placeholder instead of
        // the keyless shell during the brief purge-then-redirect window.
        <div
          data-print-protect
          className="flex min-h-screen items-center justify-center bg-bg text-ink-soft"
        >
          <p className="text-[13.5px]" role="status">
            {t('auth.login.signingOut')}
          </p>
        </div>
      ) : (
        <div data-print-protect className="flex min-h-screen bg-bg text-ink">
          <Sidebar />
          <main id="main" className="flex min-w-0 flex-1 flex-col">
            {ActiveView}
          </main>
        </div>
      )}
    </>
  );
}
