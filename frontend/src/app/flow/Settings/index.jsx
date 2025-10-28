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
        <header className="space-y-1">
          <h1 className="text-lg font-semibold text-gray-900">
            {t("settings.title")}
          </h1>
          <p className="text-sm text-gray-600">{t("settings.description")}</p>
        </header>

        <LanguagePreferences />
        <ModulesManager />
      </div>
    </div>
  );
}

