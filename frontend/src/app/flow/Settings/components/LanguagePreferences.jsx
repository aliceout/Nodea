import { useState, useEffect, useRef, useCallback } from "react";
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
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const feedbackTimerRef = useRef(null);

  const writeFeedback = useCallback((message) => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current);
    }
    setFeedback(message);
    feedbackTimerRef.current = setTimeout(() => setFeedback(""), 2500);
  }, []);

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
        } else if (!cancelled) {
          setErrorMessage(t("settings.language.errors.load"));
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current);
      }
    };
  }, [user?.id, mainKey, markMissing, setLanguage, t]);

  const persistLanguage = useCallback(
    async (nextLanguage) => {
      if (!user?.id || !mainKey) return;
      setIsSaving(true);
      setErrorMessage("");
      try {
        const nextPreferences = { ...(preferences || {}), language: nextLanguage };
        await saveUserPreferences(pb, user.id, mainKey, nextPreferences);
        setPreferences(nextPreferences);
        writeFeedback(t("settings.language.saved"));
      } catch (error) {
        if (error instanceof KeyMissingError) {
          markMissing?.();
          setErrorMessage(t("settings.language.errors.missingKey"));
        } else {
          setErrorMessage(t("settings.language.errors.save"));
        }
      } finally {
        setIsSaving(false);
      }
    },
    [mainKey, markMissing, preferences, t, user?.id, writeFeedback]
  );

  const handleChange = (event) => {
    const next = event.target.value;
    if (!next || next === language) return;
    setLanguage(next);
    persistLanguage(next);
  };

  const message =
    errorMessage || feedback ? (
      <span
        className={`text-sm font-medium sm:whitespace-nowrap ${
          errorMessage ? "text-rose-600" : "text-emerald-600"
        }`}
      >
        {errorMessage || feedback}
      </span>
    ) : null;

  return (
    <SurfaceCard>
      <p className="text-sm text-slate-600">
        {t("settings.language.description")}
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,160px)_1fr] sm:items-center sm:gap-6">
        <label
          htmlFor="settings-language"
          className="text-sm font-medium text-slate-700"
        >
          {t("settings.language.selectLabel")}
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <Select
            id="settings-language"
            value={language}
            onChange={handleChange}
            className="w-full sm:max-w-md"
            inputClassName="text-sm text-slate-800"
            disabled={isSaving}
          >
            {availableLanguages.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </Select>
          <div className="min-h-[1.5rem]">{message}</div>
        </div>
      </div>
    </SurfaceCard>
  );
}

