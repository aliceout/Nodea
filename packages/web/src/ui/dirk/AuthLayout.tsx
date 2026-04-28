import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

import AuthMarketingPanel from '@/ui/dirk/AuthMarketingPanel';

export type AuthFormWidth = '360' | '400' | '420';

interface AuthLayoutProps {
  /** Big serif-ish headline displayed in the left marketing panel
   *  on `lg+` (the panel collapses below). One short sentence —
   *  the panel body fills out the rest. */
  headline: string;
  /** Marketing panel body — the supporting copy displayed under
   *  the headline. Typically `<PrivacyBody />` for the standard
   *  auth pages or a page-specific paragraph for the
   *  recovery / change-password / TOTP flows. */
  marketing: ReactNode;
  /** Form column max-width. The auth surface ships three values:
   *  `360` (Login, Register, ChangePassword, RequestReset, Totp,
   *  LoginMfa, …), `400` (Recover, Passkeys), `420` (RecoveryCode).
   *  Default is `360`. */
  maxWidth?: AuthFormWidth;
  children: ReactNode;
}

/**
 * Two-column auth-page chassis — Direction K · Sauge.
 *
 * Marketing panel on the left (collapses below `lg`), centered
 * form column on the right with a fade-up entrance. The form
 * column max-width varies between pages (360 / 400 / 420 px) — the
 * `maxWidth` prop covers all current usages without hard-coding.
 *
 * Used by every auth surface (Login, Register, Reset, Recover,
 * RequestReset, RecoveryCode, Passkeys, ChangePassword, Totp,
 * LoginMfa, BypassConfirm, Activate, SecurityMode). Each page
 * used to copy the same `<div className="grid min-h-screen ...
 * lg:grid-cols-[1fr_480px]">` chassis verbatim.
 */
const MAX_WIDTH_CLASS: Record<AuthFormWidth, string> = {
  '360': 'max-w-[360px]',
  '400': 'max-w-[400px]',
  '420': 'max-w-[420px]',
};

export default function AuthLayout({
  headline,
  marketing,
  maxWidth = '360',
  children,
}: AuthLayoutProps) {
  return (
    <div className="grid min-h-screen grid-cols-1 bg-bg text-ink lg:grid-cols-[1fr_480px]">
      <AuthMarketingPanel headline={headline}>{marketing}</AuthMarketingPanel>
      <main className="flex items-center justify-center px-6 py-16 sm:px-14">
        <div
          className={cn(
            'animate-fade-up w-full',
            MAX_WIDTH_CLASS[maxWidth],
          )}
        >
          {children}
        </div>
      </main>
    </div>
  );
}
