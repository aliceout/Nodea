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
 * UI primitives (still JSX)
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
declare module '@/ui/atoms/base/Modal' {
  import type { ComponentType, ReactNode } from 'react';
  const Modal: ComponentType<{
    open: boolean;
    onClose?: (() => void) | null;
    children?: ReactNode;
    className?: string;
    backdropClass?: string;
    disableClose?: boolean;
  }>;
  export default Modal;
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
 * Legacy module entry points — imported lazily from `modules_list.tsx`.
 * Vite resolves the `.jsx`; TS (allowJs: false) needs the shape stub.
 * ------------------------------------------------------------------ */
declare module '@/app/flow/Mood' {
  import type { ComponentType } from 'react';
  const MoodIndex: ComponentType;
  export default MoodIndex;
}
declare module '@/app/flow/Goals' {
  import type { ComponentType } from 'react';
  const GoalsIndex: ComponentType;
  export default GoalsIndex;
}
declare module '@/app/flow/Passage' {
  import type { ComponentType } from 'react';
  const PassageIndex: ComponentType;
  export default PassageIndex;
}

/* --------------------------------------------------------------------
 * Cross-module Mood leak-throughs (Homepage consumes these).
 * ------------------------------------------------------------------ */
declare module '@/app/flow/Mood/hooks/useMoodTrend' {
  export interface MoodTrendRow {
    date: string;
    mood: number;
    emoji: string;
  }
  export interface MoodTrendState {
    status: 'idle' | 'loading' | 'ready' | 'error' | 'missing-key' | 'missing-module';
    data: MoodTrendRow[];
    error: string;
    hasData: boolean;
  }
  export default function useMoodTrend(options?: {
    months?: number;
    latestEntries?: number;
  }): MoodTrendState;
}
declare module '@/app/flow/Mood/components/ChartBody' {
  import type { ComponentType } from 'react';
  const ChartBody: ComponentType<{
    data: Array<{ date: string; mood: number; emoji?: string }>;
  }>;
  export default ChartBody;
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
