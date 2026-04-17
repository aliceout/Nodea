import Subheader from '@/ui/layout/headers/Subheader';
import SectionHeader from '@/ui/atoms/typography/SectionHeader.jsx';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import ModulesManager from './components/ModulesManager';
import LanguagePreferences from './components/LanguagePreferences';
import ThemePreferences from './components/ThemePreferences';

export default function SettingsPage() {
  const { t } = useI18n();

  return (
    <div className="h-full bg-slate-50 transition-colors dark:bg-slate-900">
      <Subheader />
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        <section className="space-y-3">
          <SectionHeader
            title={t('settings.theme.title', { defaultValue: 'Thème' })}
            description={t('settings.theme.description', {
              defaultValue: 'Apparence claire, sombre ou système.',
            })}
          />
          <ThemePreferences />
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={t('settings.language.title', { defaultValue: 'Langue' })}
            description={t('settings.language.description', {
              defaultValue: 'Langue d’affichage de l’application.',
            })}
          />
          <LanguagePreferences />
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={t('settings.modules.title', { defaultValue: 'Modules' })}
            description={t('settings.modules.description', {
              defaultValue: 'Activer ou désactiver les modules.',
            })}
          />
          <ModulesManager />
        </section>
      </div>
    </div>
  );
}
