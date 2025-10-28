import Subheader from "@/ui/layout/headers/Subheader.jsx";
import ModulesManager from "./components/ModulesManager.jsx";
import LanguagePreferences from "./components/LanguagePreferences.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function Settings() {
  const { t } = useI18n();

  return (
    <div className="h-full bg-slate-50">
      <Subheader />
      <div className="mx-auto max-w-3xl p-6 space-y-6">
        <section className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-800 mb-2">
            {t("settings.language.title")}
          </h2>
          <LanguagePreferences />
        </section>

        <section className="space-y-3">
          <header className="space-y-1">
            <h2 className="text-lg font-semibold text-gray-800 mb-2">
              {t("settings.modules.title")}
            </h2>
          </header>

          <ModulesManager />
        </section>
      </div>
    </div>
  );
}
