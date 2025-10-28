import { useEffect } from "react";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Select from "@/ui/atoms/form/Select.jsx";
import FormField from "@/ui/atoms/form/FormField.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import { useUserPreferences } from "@/core/preferences/useUserPreferences";

export default function LanguagePreferences() {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const { preferences, updatePreferences, isSaving } = useUserPreferences();

  useEffect(() => {
    const remoteLanguage = preferences?.language;
    if (remoteLanguage && remoteLanguage !== language) {
      setLanguage(remoteLanguage);
    }
  }, [preferences?.language, language, setLanguage]);

  const handleChange = (event) => {
    const next = event.target.value;
    if (!next || next === language) return;
    const previous = language;
    setLanguage(next);
    updatePreferences((current = {}) => ({
      ...current,
      language: next,
    })).catch((error) => {
      console.error("[LanguagePreferences] save error", error);
      setLanguage(previous);
    });
  };

  return (
    <SurfaceCard tone="base" border="default" padding="md">
      <FormField label={t("settings.language.selectLabel")} htmlFor="settings-language">
        <Select
          id="settings-language"
          value={language}
          onChange={handleChange}
          className="w-full sm:w-72"
          disabled={isSaving}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </Select>
      </FormField>
    </SurfaceCard>
  );
}
