import { useState } from "react";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Select from "@/ui/atoms/form/Select.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";

export default function LanguagePreferences() {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const [feedback, setFeedback] = useState("");

  const handleChange = (event) => {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
    setFeedback(t("settings.language.saved"));
    window.setTimeout(() => setFeedback(""), 2000);
  };

  return (
    <SurfaceCard >
      <p className="text-sm text-slate-600">
        {t("settings.language.description")}
      </p>

      <div className="mt-4 gap-3 flex sm:flex-row sm:items-center sm:gap-6">
        <label htmlFor="settings-language" className="text-sm font-medium text-slate-700">
          {t("settings.language.selectLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Select
            id="settings-language"
            value={language}
            onChange={handleChange}
            className="w-full sm:max-w-md"
            inputClassName="text-sm text-slate-800"
          >
            {availableLanguages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </Select>
          {feedback ? (
            <span className="text-sm font-medium text-emerald-600 sm:whitespace-nowrap">
              {feedback}
            </span>
          ) : null}
        </div>
      </div>
    </SurfaceCard>
  );
}
