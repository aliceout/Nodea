import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import Topbar from '@/ui/dirk/Topbar';

import { HomepageProvider, useHomepageData } from './context';
import PrimaryColumn from './views/PrimaryColumn';

/**
 * Homepage — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k.jsx
 * → K_Home`. Layout = topbar + 2-column body (1fr content + 280px
 * aside). All colours / sizes / animations come from the tokens
 * registered in `ui/theme/dirk.css`.
 *
 * Architecture (matches Library / Goals / Journal / Mood) :
 *   - `<HomepageProvider>` (`./context.tsx`) owns the page-local
 *     state — the three lite-shape fetches (Mood / Goals /
 *     Library), the locale-aware date label, the user's display
 *     name. Single context (Home is read-only by design — no
 *     filters, no mutations — so the « 3 contexts » pattern
 *     would just be boilerplate here).
 *   - `<HomepageView />` reads only the topbar's date label ;
 *     the columns and their blocks subscribe to the context
 *     themselves.
 *   - Pure helpers in `lib/` (format, frise, intentions,
 *     projections, types, constants) carry the Vitest coverage.
 *
 * The mobile sidebar drawer is opened from the topbar's
 * hamburger (preserves the existing `mobileMenuOpen` slice so
 * nothing else has to change).
 */
export default function HomePage() {
  return (
    <HomepageProvider>
      <HomepageView />
    </HomepageProvider>
  );
}

function HomepageView() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { t } = useI18n();
  const { formattedDate } = useHomepageData();

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={formattedDate}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="primary" size="sm" onClick={() => openComposer()}>
            {t('home.topbar.newEntry', { defaultValue: '+ Nouvelle entrée' })}
          </Button>
        </Topbar>
      }
    >
      <PrimaryColumn />
    </ModuleShell>
  );
}
