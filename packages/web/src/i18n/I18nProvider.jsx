import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { translate as translateRaw, translatePlural as translatePluralRaw } from "./translate.ts";

import frCommon from "@/i18n/locales/fr/common.json";
import frLayout from "@/i18n/locales/fr/layout.json";
import frAuth from "@/i18n/locales/fr/auth.json";
import frHome from "@/i18n/locales/fr/home.json";
import frAccount from "@/i18n/locales/fr/account.json";
import frSettings from "@/i18n/locales/fr/settings.json";
import frGoals from "@/i18n/locales/fr/goals.json";
import frMood from "@/i18n/locales/fr/mood.json";
import frJournal from "@/i18n/locales/fr/journal.json";
import frAdmin from "@/i18n/locales/fr/admin.json";
import frModals from "@/i18n/locales/fr/modals.json";
import frModules from "@/i18n/locales/fr/modules.json";
import frErrors from "@/i18n/locales/fr/errors.json";
import frReview from "@/i18n/locales/fr/review.json";
import frLibrary from "@/i18n/locales/fr/library.json";
import frHrt from "@/i18n/locales/fr/hrt.json";
import frHabits from "@/i18n/locales/fr/habits.json";

import enCommon from "@/i18n/locales/en/common.json";
import enLayout from "@/i18n/locales/en/layout.json";
import enAuth from "@/i18n/locales/en/auth.json";
import enHome from "@/i18n/locales/en/home.json";
import enAccount from "@/i18n/locales/en/account.json";
import enSettings from "@/i18n/locales/en/settings.json";
import enGoals from "@/i18n/locales/en/goals.json";
import enMood from "@/i18n/locales/en/mood.json";
import enJournal from "@/i18n/locales/en/journal.json";
import enAdmin from "@/i18n/locales/en/admin.json";
import enModals from "@/i18n/locales/en/modals.json";
import enModules from "@/i18n/locales/en/modules.json";
import enErrors from "@/i18n/locales/en/errors.json";
import enReview from "@/i18n/locales/en/review.json";
import enLibrary from "@/i18n/locales/en/library.json";
import enHrt from "@/i18n/locales/en/hrt.json";
import enHabits from "@/i18n/locales/en/habits.json";

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
    journal: frJournal,
    admin: frAdmin,
    modals: frModals,
    modules: frModules,
    errors: frErrors,
    review: frReview,
    library: frLibrary,
    hrt: frHrt,
    habits: frHabits,
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
    journal: enJournal,
    admin: enAdmin,
    modals: enModals,
    modules: enModules,
    errors: enErrors,
    review: enReview,
    library: enLibrary,
    hrt: enHrt,
    habits: enHabits,
  },
};

const I18nContext = createContext(null);

// Bind the pure resolvers to the bundled RESOURCES + DEFAULT_LANGUAGE.
function translate(language, key, options) {
  return translateRaw(RESOURCES, language, key, {
    fallback: DEFAULT_LANGUAGE,
    ...(options ?? {}),
  });
}

/**
 * Plural-aware translate. Picks `<key>.<rule>` where `<rule>` is
 * the result of `Intl.PluralRules(language).select(count)` —
 * one of `zero | one | two | few | many | other`. Falls back to
 * `<key>.other`, then the bare `<key>` string. See
 * `translate.ts` for the pure logic + tests.
 *
 * Why a custom `tn` rather than ICU MessageFormat : the
 * `intl-messageformat` lib adds ~10 kB gzip and brings parsing
 * overhead the FR + EN duo doesn't pay back today. Re-evaluate
 * when a 3rd language with richer plural rules (russian, polish,
 * arabic) lands.
 */
function translatePlural(language, key, count, options) {
  return translatePluralRaw(RESOURCES, language, key, count, {
    fallback: DEFAULT_LANGUAGE,
    ...(options ?? {}),
  });
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

  const tn = useCallback(
    (key, count, options) => translatePlural(language, key, count, options),
    [language]
  );

  const value = useMemo(
    () => ({
      language,
      setLanguage,
      availableLanguages: Object.values(SUPPORTED_LANGUAGES),
      t,
      tn,
    }),
    [language, setLanguage, t, tn]
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

