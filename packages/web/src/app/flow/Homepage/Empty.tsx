import { useMemo } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Topbar from '@/ui/dirk/Topbar';

/**
 * EmptyHomepage — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k-extras.jsx
 * → K_Empty`. Variant of `Homepage` shown to a user who has nothing
 * yet — the editorial intent is "une page blanche", not a stack of
 * empty cards. Two CTAs (Saisir mon premier mood / Faire le tour),
 * a serif-italic invitation, and a discreet ⌘K reminder at the
 * bottom of the column.
 *
 * The "premier mood" CTA opens the global composer with
 * `type='mood'`. The "tour" CTA is a placeholder until the guided
 * onboarding mini-walkthrough lands.
 */
export default function EmptyHomepage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { language } = useI18n();

  const formattedDate = useMemo(() => {
    const now = new Date();
    const localeTag = language === 'en' ? 'en-US' : 'fr-FR';
    const formatter = new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    return `${formatter.format(now)} · jour ${dayOfYear}`;
  }, [language]);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        label={formattedDate}
        onOpenMenu={() => setMobileMenuOpen(true)}
      >
        <Button variant="primary" size="sm" onClick={() => openComposer('mood')}>
          + Nouvelle entrée
        </Button>
      </Topbar>

      <div className="flex flex-1 flex-col items-start px-6 py-16 sm:px-14 sm:py-20 lg:py-[92px]">
        <div className="max-w-[640px]">
          <p className="mb-3 text-[12px] font-semibold uppercase tracking-[0.04em] text-accent">
            Premier jour
          </p>
          <h1 className="mb-[18px] text-[44px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            Une page blanche.
          </h1>
          <p className="mb-8 font-serif text-[18px] italic leading-[1.55] text-ink-soft">
            Tu n&rsquo;as encore rien écrit. C&rsquo;est le bon endroit pour commencer. Une
            humeur, un passage, une intention — l&rsquo;ordre n&rsquo;a pas d&rsquo;importance.
          </p>

          <div className="mb-14 flex flex-wrap gap-2.5">
            <Button
              variant="primary"
              size="md"
              onClick={() => openComposer('mood')}
            >
              Saisir mon premier mood
            </Button>
            <Button variant="neutral" size="md">
              Faire le tour d&rsquo;abord
            </Button>
          </div>

          <p className="text-[12px] leading-[1.7] text-muted">
            Astuce :{' '}
            <kbd className="rounded border border-hair bg-bg-2 px-1.5 py-px font-mono text-[11px] text-ink-soft">
              ⌘K
            </kbd>{' '}
            ouvre l&rsquo;écriture rapide depuis n&rsquo;importe où.
          </p>
        </div>
      </div>
    </div>
  );
}

