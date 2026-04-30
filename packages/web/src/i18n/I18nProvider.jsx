import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import frCommon from "@/i18n/locales/fr/common.json";
import frLayout from "@/i18n/locales/fr/layout.json";
import frAuth from "@/i18n/locales/fr/auth.json";
import frHome from "@/i18n/locales/fr/home.json";
import frAccount from "@/i18n/locales/fr/account.json";
import frSettings from "@/i18n/locales/fr/settings.json";
import frGoals from "@/i18n/locales/fr/goals.json";
import frMood from "@/i18n/locales/fr/mood.json";
import frPassage from "@/i18n/locales/fr/passage.json";
import frAdmin from "@/i18n/locales/fr/admin.json";
import frModals from "@/i18n/locales/fr/modals.json";
import frModules from "@/i18n/locales/fr/modules.json";
import frErrors from "@/i18n/locales/fr/errors.json";
import frReview from "@/i18n/locales/fr/review.json";

import enCommon from "@/i18n/locales/en/common.json";
import enLayout from "@/i18n/locales/en/layout.json";
import enAuth from "@/i18n/locales/en/auth.json";
import enHome from "@/i18n/locales/en/home.json";
import enAccount from "@/i18n/locales/en/account.json";
import enSettings from "@/i18n/locales/en/settings.json";
import enGoals from "@/i18n/locales/en/goals.json";
import enMood from "@/i18n/locales/en/mood.json";
import enPassage from "@/i18n/locales/en/passage.json";
import enAdmin from "@/i18n/locales/en/admin.json";
import enModals from "@/i18n/locales/en/modals.json";
import enModules from "@/i18n/locales/en/modules.json";
import enErrors from "@/i18n/locales/en/errors.json";
import enReview from "@/i18n/locales/en/review.json";

const STORAGE_KEY = "nodea:language";
const DEFAULT_LANGUAGE = "fr";

const SUPPORTED_LANGUAGES = {
  fr: { id: "fr", label: "Français" },
  en: { id: "en", label: "English" },
};

const RESOURCES = {
  fr: {
    common: frCommon,
    layout: frLayout,
    auth: frAuth,
    home: frHome,
    account: frAccount,
    settings: frSettings,
    goals: frGoals,
    mood: frMood,
    passage: frPassage,
    admin: frAdmin,
    modals: frModals,
    modules: frModules,
    errors: frErrors,
    review: frReview,
  },
  en: {
    common: enCommon,
    layout: enLayout,
    auth: enAuth,
    home: enHome,
    account: enAccount,
    settings: enSettings,
    goals: enGoals,
    mood: enMood,
    passage: enPassage,
    admin: enAdmin,
    modals: enModals,
    modules: enModules,
    errors: enErrors,
    review: enReview,
  },
};

const I18nContext = createContext(null);

function resolvePath(resource, segments) {
  return segments.reduce(
    (acc, key) => (acc && acc[key] !== undefined ? acc[key] : undefined),
    resource
  );
}

function applyInterpolation(message, values) {
  if (typeof message !== "string" || !values) return message;
  return message.replace(/\{([^}]+)\}/g, (_, token) => {
    const value = values[token.trim()];
    return value !== undefined && value !== null ? String(value) : "";
  });
}

function translate(language, key, options = {}) {
  const { fallback = DEFAULT_LANGUAGE, values, defaultValue } = options;
  const segments = key.split(".").filter(Boolean);
  if (!segments.length) {
    return typeof defaultValue === "string" ? defaultValue : key;
  }

  const [namespace, ...path] = segments;
  const resource = RESOURCES[language]?.[namespace];
  let message =
    (resource && resolvePath(resource, path)) ?? undefined;

  if (message === undefined && fallback && fallback !== language) {
    const fallbackResource = RESOURCES[fallback]?.[namespace];
    message =
      (fallbackResource && resolvePath(fallbackResource, path)) ?? undefined;
  }

  if (message === undefined) {
    return typeof defaultValue === "string" ? defaultValue : key;
  }

  return applyInterpolation(message, values);
}

function detectInitialLanguage() {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const stored = window.localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED_LANGUAGES[stored]) {
    return stored;
  }

  const navigatorLang =
    window.navigator?.language || window.navigator?.languages?.[0];
  if (navigatorLang) {
    const normalized = navigatorLang.toLowerCase().split("-")[0];
    if (SUPPORTED_LANGUAGES[normalized]) {
      return normalized;
    }
  }

  return DEFAULT_LANGUAGE;
}

import { useNodeaStore } from "@/core/store/nodea-store";
import { saveEncryptedPreferences } from "@/core/api/preferences-client";

export function I18nProvider({ children }) {
  const [language, setLanguageState] = useState(detectInitialLanguage);

  // When the preferences slice hydrates with a different language than
  // what we detected from localStorage, adopt it (server wins once the
  // user is signed in — that's the cross-device sync contract).
  useEffect(() => {
    const unsub = useNodeaStore.subscribe((state) => {
      const next = state.preferences?.language;
      if (next && SUPPORTED_LANGUAGES[next]) {
        setLanguageState((prev) => (prev === next ? prev : next));
      }
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, language);
  }, [language]);

  // Keep <html lang> in sync so screen readers and `:lang(fr|en)`
  // CSS selectors pick up the active locale. index.html ships
  // `<html lang="en">` as a static placeholder — without this
  // effect a FR user kept the EN attribute permanently.
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback(async (nextLanguage) => {
    const normalized = String(nextLanguage || "").toLowerCase();
    if (!SUPPORTED_LANGUAGES[normalized]) return;
    setLanguageState(normalized);

    // Persist to the encrypted blob — fire-and-forget. When the user
    // isn't signed in yet (no main key), the localStorage effect above
    // is the only store; server sync kicks in on next login.
    try {
      const state = useNodeaStore.getState();
      const mainKey = state.crypto?.main;
      if (!mainKey) return;
      state.updatePreferences({ language: normalized });
      await saveEncryptedPreferences(mainKey.aesKey, {
        ...state.preferences,
        language: normalized,
      });
    } catch {
      // network / decrypt failure — local state is already updated
    }
  }, []);

  const t = useCallback(
    (key, options) => translate(language, key, options),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: Object.values(SUPPORTED_LANGUAGES),
      t,
    }),
    [language, setLanguage, t]
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// `useI18n` and `translateKey` are the official non-component
// exports of this provider — splitting would create three files
// for what is conceptually one boundary. The exhaustive-deps
// false positive is silenced.
// eslint-disable-next-line react-refresh/only-export-components
export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used within I18nProvider");
  }
  return context;
}

// eslint-disable-next-line react-refresh/only-export-components
export function translateKey(key, options) {
  return translate(DEFAULT_LANGUAGE, key, options);
}

