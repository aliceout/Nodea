import { useState } from "react";
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
    <section className="mb-8 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 space-y-1">
        <h2 className="text-base font-semibold text-slate-900">
          {t("settings.language.title")}
        </h2>
        <p className="text-sm text-slate-600">
          {t("settings.language.description")}
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <label
          htmlFor="settings-language"
          className="text-sm font-medium text-slate-700"
        >
          {t("settings.language.selectLabel")}
        </label>
        <select
          id="settings-language"
          value={language}
          onChange={handleChange}
          className="w-full max-w-xs rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </select>
      </div>

      {feedback ? (
        <p className="mt-3 text-sm font-medium text-emerald-600">{feedback}</p>
      ) : null}
    </section>
  );
}

