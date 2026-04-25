import { type ChangeEvent } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ThemeToggle from '@/ui/dirk/ThemeToggle';
import ModulesManager from './components/ModulesManager';

/**
 * Settings — Direction K · Sauge.
 *
 * Mirrors the Mood / Account / Passages shell: sticky topbar, K
 * tokens (`bg-bg`, `text-ink`, `border-hair`), one-column layout
 * sized like Account so the page reads as part of the same family.
 *
 * Sections:
 * - Thème — tri-state light / system / dark via the K `ThemeToggle`
 *   (the same component the sidebar uses, in its labeled variant).
 * - Langue — native `<select>` styled with K tokens (the legacy
 *   `LanguagePreferences` wrapper is gone — it was a one-line
 *   indirection over `useI18n`).
 * - Modules — `ModulesManager` in its `cards` layout, restyled to K.
 */
export default function SettingsPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { t } = useI18n();

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        title={t('modules.settings.label', { defaultValue: 'Paramètres' })}
        onOpenMenu={() => setMobileMenuOpen(true)}
      />

      <div className="mx-auto w-full max-w-[720px] px-6 py-7 sm:px-9">
        <header className="mb-9">
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            {t('modules.settings.label', { defaultValue: 'Paramètres' })}
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {t('settings.subtitle', { defaultValue: 'Apparence, langue, modules.' })}
          </p>
        </header>

        <Section
          title={t('settings.theme.title', { defaultValue: 'Thème' })}
          description={t('settings.theme.description', {
            defaultValue: 'Apparence claire, sombre ou système.',
          })}
        >
          <ThemeToggle variant="labeled" />
        </Section>

        <Section
          title={t('settings.language.title', { defaultValue: 'Langue' })}
          description={t('settings.language.description', {
            defaultValue: 'Langue d’affichage de l’application.',
          })}
        >
          <LanguageSection />
        </Section>

        <Section
          title={t('settings.modules.title', { defaultValue: 'Modules' })}
          description={t('settings.modules.description', {
            defaultValue: 'Activer ou désactiver les modules.',
          })}
        >
          <ModulesManager />
        </Section>
      </div>
    </div>
  );
}

interface TopbarProps {
  title: string;
  onOpenMenu: () => void;
}

function Topbar({ title, onOpenMenu }: TopbarProps) {
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-hair bg-bg px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] tracking-[0.02em] text-muted">{title}</span>
      </div>
    </div>
  );
}

interface SectionProps {
  title: string;
  description: string;
  children: React.ReactNode;
}

function Section({ title, description, children }: SectionProps) {
  return (
    <section className="mb-10 last:mb-0">
      <header className="mb-3.5 border-b border-hair pb-2">
        <h2 className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</h2>
        <p className="mt-0.5 text-[12.5px] text-muted">{description}</p>
      </header>
      {children}
    </section>
  );
}

function LanguageSection() {
  const { t, language, setLanguage, availableLanguages } = useI18n();

  function handleChange(event: ChangeEvent<HTMLSelectElement>): void {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
  }

  return (
    <div>
      <label
        htmlFor="settings-language"
        className="mb-1.5 block text-[12px] font-medium text-muted"
      >
        {t('settings.language.selectLabel', { defaultValue: 'Langue' })}
      </label>
      <select
        id="settings-language"
        value={language}
        onChange={handleChange}
        className="w-full max-w-[280px] cursor-pointer rounded-md border border-hair bg-bg px-3 py-2 text-[13px] text-ink transition-[border-color,box-shadow] focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none"
      >
        {availableLanguages.map((lang) => (
          <option key={lang.id} value={lang.id}>
            {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
}
