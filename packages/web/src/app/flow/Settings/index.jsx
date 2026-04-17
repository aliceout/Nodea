import Subheader from "@/ui/layout/headers/Subheader.jsx";
import ModulesManager from "./components/ModulesManager.jsx";
import LanguagePreferences from "./components/LanguagePreferences.jsx";
import ThemePreferences from "./components/ThemePreferences.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import SectionHeader from "@/ui/atoms/typography/SectionHeader.jsx";

export default function Settings() {
  const { t } = useI18n();

  return (
    <div className="h-full bg-slate-50 transition-colors dark:bg-slate-900">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <section className="space-y-3">
          <SectionHeader
            title={t("settings.theme.title")}
            description={t("settings.theme.description")}
          />
          <ThemePreferences />
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={t("settings.language.title")}
            description={t("settings.language.description")}
          />
          <LanguagePreferences />
        </section>

        <section className="space-y-3">
          <SectionHeader
            title={t("settings.modules.title")}
            description={t("settings.modules.description")}
          />
          <ModulesManager />
        </section>
      </div>
    </div>
  );
}
