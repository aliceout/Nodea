import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

export type SidebarTipKind = 'info' | 'warning' | 'danger';

/**
 * Generic tip slot rendered above the sidebar footer. Used for
 * dismissable nudges — onboarding hints, security recommendations,
 * etc. The visible chrome adapts to a `kind` so a security warning
 * (TOTP / passkey not configured) reads with more weight than an
 * informational note (modules are on by default).
 *
 * Tones map to existing K · Sauge tokens where possible
 * (`accent` / `danger`) and the Tailwind amber palette for
 * `warning` since the project doesn't ship a dedicated warning
 * token. If a fourth tone is needed later, extend the union here
 * rather than overloading one of the existing ones.
 *
 * Dismissal is per-device via `localStorage[dismissKey]`. If
 * `dismissKey` is omitted, the tip is non-dismissable — appropriate
 * for warnings the user needs to act on (e.g. "TOTP not set up"
 * shouldn't be silenced before the user actually does something).
 */
export interface SidebarTipProps {
  kind?: SidebarTipKind;
  dismissKey?: string;
  children: ReactNode;
}

const TONE_CLASS: Record<SidebarTipKind, string> = {
  // Sage wash + accent left rail. Used for the modules nudge and
  // any other "by the way" message.
  info: 'border-l-2 border-accent bg-accent/5',
  // Amber wash + amber rail. Picked because the project's `low`
  // token is too pink/blushy for a security-prompt tone, and a
  // straight `danger` red would over-escalate.
  warning:
    'border-l-2 border-amber-500 bg-amber-500/10 dark:bg-amber-500/15',
  // The existing danger token, same register as the destructive
  // banners on Reset / DangerTab.
  danger: 'border-l-2 border-danger bg-danger/5',
};

export default function SidebarTip({
  kind = 'info',
  dismissKey,
  children,
}: SidebarTipProps) {
  const dismissable = typeof dismissKey === 'string' && dismissKey.length > 0;
  const [dismissed, setDismissed] = useState<boolean>(() => {
    if (!dismissable || typeof window === 'undefined') return false;
    return window.localStorage.getItem(dismissKey) === 'dismissed';
  });

  if (dismissed) return null;

  function handleDismiss(): void {
    if (!dismissable) return;
    setDismissed(true);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(dismissKey, 'dismissed');
    }
  }

  return (
    <div
      role="note"
      className={cn(
        'mx-2 mb-2 rounded-r-md px-2.5 py-2',
        TONE_CLASS[kind],
      )}
    >
      <p className="text-[11.5px] leading-[1.45] text-ink-soft">{children}</p>
      {dismissable ? (
        <button
          type="button"
          onClick={handleDismiss}
          className="mt-1.5 cursor-pointer text-[10.5px] text-muted transition-colors hover:text-ink"
        >
          Compris
        </button>
      ) : null}
    </div>
  );
}

/**
 * Specific instance: the « tous les modules sont activés » nudge
 * shown after the first-run seed. Wraps {@link SidebarTip} with
 * fixed copy + a link to the place the user can opt out from.
 */
export function SidebarTipModules() {
  return (
    <SidebarTip kind="info" dismissKey="nodea:home:tip-modules">
      Tous les modules sont activés par défaut.{' '}
      <Link
        to="/flow/account"
        className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
      >
        Personnaliser →
      </Link>
    </SidebarTip>
  );
}
