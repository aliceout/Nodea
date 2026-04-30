/**
 * Ambient declarations for legacy JSX modules still consumed by TSX code.
 *
 * Each entry exists because TS (with `allowJs: false`) can't resolve a
 * bare `@/…` import to a `.jsx` file. Declaring them here keeps the
 * type-check pass fast (no legacy JSX gets parsed) while letting the
 * new TSX surface grow independently.
 *
 * Remove an entry as soon as its target is migrated to TSX and gets
 * real types from its own `.tsx`.
 */

/* --------------------------------------------------------------------
 * i18n provider — named `useI18n` hook consumed from TSX
 * ------------------------------------------------------------------ */
declare module '@/i18n/I18nProvider.jsx' {
  import type { ComponentType, ReactNode } from 'react';

  export interface I18nTranslateOptions {
    defaultValue?: string;
    [key: string]: unknown;
  }

  export interface I18nValue {
    language: string;
    setLanguage: (lang: string) => void;
    /** Legacy shape: `{ id, label }` per the JSX provider implementation. */
    availableLanguages: Array<{ id: string; label: string }>;
    t: (key: string, options?: I18nTranslateOptions) => string;
    /** Plural-aware translate. Picks `<key>.<rule>` where rule
     *  comes from `Intl.PluralRules(language).select(count)` —
     *  one of `zero | one | two | few | many | other`. Falls back
     *  to `<key>.other` then the bare `<key>`. `count` is auto-
     *  injected into `values.count`. */
    tn: (
      key: string,
      count: number,
      options?: I18nTranslateOptions,
    ) => string;
  }

  export const I18nProvider: ComponentType<{ children?: ReactNode }>;
  export function useI18n(): I18nValue;
  export function translateKey(key: string, options?: I18nTranslateOptions): string;
}
