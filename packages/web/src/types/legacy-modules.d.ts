/**
 * Ambient declarations for legacy JSX modules consumed by TSX code.
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
 * Flow module entry points (lazy-loaded from modules_list.tsx)
 * ------------------------------------------------------------------ */
declare module '@/app/flow/Homepage' {
  import type { ComponentType } from 'react';
  const Home: ComponentType<Record<string, unknown>>;
  export default Home;
}
declare module '@/app/flow/Mood' {
  import type { ComponentType } from 'react';
  const Mood: ComponentType<Record<string, unknown>>;
  export default Mood;
}
declare module '@/app/flow/Passage' {
  import type { ComponentType } from 'react';
  const Passage: ComponentType<Record<string, unknown>>;
  export default Passage;
}
declare module '@/app/flow/Goals' {
  import type { ComponentType } from 'react';
  const Goals: ComponentType<Record<string, unknown>>;
  export default Goals;
}
declare module '@/app/flow/Account' {
  import type { ComponentType } from 'react';
  const Account: ComponentType<Record<string, unknown>>;
  export default Account;
}
declare module '@/app/flow/Settings' {
  import type { ComponentType } from 'react';
  const Settings: ComponentType<Record<string, unknown>>;
  export default Settings;
}

/* --------------------------------------------------------------------
 * UI primitives (legacy JSX, gradually being migrated to TSX)
 * ------------------------------------------------------------------ */
declare module '@/ui/atoms/base/Button' {
  import type { ComponentType, ReactNode } from 'react';
  const Button: ComponentType<{
    children?: ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    type?: 'button' | 'submit' | 'reset';
    variant?: string;
    disabled?: boolean;
    className?: string;
    [k: string]: unknown;
  }>;
  export default Button;
}
declare module '@/ui/atoms/form/Input' {
  import type { ComponentType, InputHTMLAttributes } from 'react';
  const Input: ComponentType<InputHTMLAttributes<HTMLInputElement>>;
  export default Input;
}
declare module '@/ui/atoms/form/FormError' {
  import type { ComponentType, ReactNode } from 'react';
  const FormError: ComponentType<{ children?: ReactNode; className?: string }>;
  export default FormError;
}
declare module '@/ui/layout/headers/Subheader' {
  import type { ComponentType, ReactNode } from 'react';
  const Subheader: ComponentType<{
    tabs?: Array<{ id: string; label: string }>;
    onTabSelect?: (id: string) => void;
    className?: string;
    children?: ReactNode;
  }>;
  export default Subheader;
}

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
  }

  export const I18nProvider: ComponentType<{ children?: ReactNode }>;
  export function useI18n(): I18nValue;
  export function translateKey(key: string, options?: I18nTranslateOptions): string;
}
