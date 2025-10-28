import { useState, useEffect, useCallback } from "react";
import SurfaceCard from "@/ui/atoms/specifics/SurfaceCard.jsx";
import Select from "@/ui/atoms/form/Select.jsx";
import { useI18n } from "@/i18n/I18nProvider.jsx";
import { useStore } from "@/core/store/StoreProvider";
import useAuth from "@/core/auth/useAuth";
import pb from "@/core/api/pocketbase";
import {
  loadUserPreferences,
  saveUserPreferences,
} from "@/core/api/user-preferences";
import { KeyMissingError } from "@/core/crypto/webcrypto";

export default function LanguagePreferences() {
  const { t, language, setLanguage, availableLanguages } = useI18n();
  const { mainKey, markMissing } = useStore();
  const { user } = useAuth();

  const [preferences, setPreferences] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!user?.id || !mainKey) return;
      try {
        const stored = await loadUserPreferences(pb, user.id, mainKey);
        if (cancelled) return;
        setPreferences(stored || {});
        const remoteLanguage = stored?.language;
        if (remoteLanguage && remoteLanguage !== language) {
          setLanguage(remoteLanguage);
        }
      } catch (error) {
        if (error instanceof KeyMissingError) {
          markMissing?.();
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [user?.id, mainKey, markMissing, setLanguage, language]);

  const persistLanguage = useCallback(
    async (nextLanguage, fallbackLanguage) => {
      if (!user?.id || !mainKey) return;
      setIsSaving(true);
      try {
        const nextPreferences = { ...(preferences || {}), language: nextLanguage };
        await saveUserPreferences(pb, user.id, mainKey, nextPreferences);
        setPreferences(nextPreferences);
      } catch (error) {
        if (error instanceof KeyMissingError) {
          markMissing?.();
        } else {
          console.error("[LanguagePreferences] save error", error);
        }
        if (fallbackLanguage) {
          setLanguage(fallbackLanguage);
        }
      } finally {
        setIsSaving(false);
      }
    },
    [mainKey, markMissing, preferences, setLanguage, user?.id]
  );

  const handleChange = (event) => {
    const next = event.target.value;
    if (!next || next === language) return;
    const previous = language;
    setLanguage(next);
    persistLanguage(next, previous);
  };

  return (
    <SurfaceCard>
      <p className="text-sm text-slate-600">
        {t("settings.language.description")}
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Select
          id="settings-language"
          value={language}
          onChange={handleChange}
          className="w-full sm:w-72"
          inputClassName="text-sm text-slate-800"
          disabled={isSaving}
        >
          {availableLanguages.map((lang) => (
            <option key={lang.id} value={lang.id}>
              {lang.label}
            </option>
          ))}
        </Select>
      </div>
    </SurfaceCard>
  );
}

