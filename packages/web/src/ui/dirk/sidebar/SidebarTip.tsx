import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { XMarkIcon } from '@heroicons/react/24/outline';
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
  /** Short uppercase eyebrow rendered at the top of the cartouche
   * — coloured by `kind` so it doubles as the tone's signal. */
  title: string;
  kind?: SidebarTipKind;
  /** When set, a × button appears next to the title and dismissal
   * is persisted under this key in `localStorage`. Omit for tips
   * that the user must act on (e.g. « TOTP non configuré ») rather
   * than just acknowledge. */
  dismissKey?: string;
  children: ReactNode;
}

const TONE_BORDER: Record<SidebarTipKind, string> = {
  // Sage wash + full accent border. Used for the modules nudge and
  // any other "by the way" message.
  info: 'border-2 border-accent bg-accent/5',
  // Amber wash + amber border. Picked because the project's `low`
  // token is too pink/blushy for a security-prompt tone, and a
  // straight `danger` red would over-escalate.
  warning: 'border-2 border-amber-500 bg-amber-500/10 dark:bg-amber-500/15',
  // The existing danger token, same register as the destructive
  // banners on Reset / DangerTab.
  danger: 'border-2 border-danger bg-danger/5',
};

const TONE_TITLE: Record<SidebarTipKind, string> = {
  info: 'text-accent-deep',
  warning: 'text-amber-700 dark:text-amber-200',
  danger: 'text-danger',
};

export default function SidebarTip({
  title,
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
      className={cn('mx-2 mb-2 rounded-md px-2.5 py-2', TONE_BORDER[kind])}
    >
      {/* Header: tone-coloured uppercase eyebrow on the left, a
          × close button on the right when the tip is dismissable.
          The eyebrow signals the kind at a glance; the body below
          stays in the standard `text-ink-soft` so the eyebrow alone
          carries the tonal weight (no need to also tint the body). */}
      <div className="mb-1 flex items-start justify-between gap-2">
        <span
          className={cn(
            'text-[10.5px] font-semibold tracking-[0.04em] uppercase',
            TONE_TITLE[kind],
          )}
        >
          {title}
        </span>
        {dismissable ? (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Fermer"
            title="Fermer"
            className="-mt-0.5 -mr-0.5 inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg hover:text-ink"
          >
            <XMarkIcon className="h-3 w-3" aria-hidden="true" />
          </button>
        ) : null}
      </div>
      <p className="text-[11.5px] leading-[1.45] text-ink-soft">{children}</p>
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
    <SidebarTip title="Astuce" kind="info" dismissKey="nodea:home:tip-modules">
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

/**
 * Specific instance: the « pas de code de récupération » nudge
 * shown to authenticated users who haven't set up a BIP39
 * recovery code yet. **Non-dismissable** — losing the password
 * without a recovery code means destructive reset (every entry
 * gone), so we want the user to acknowledge it by acting, not by
 * clicking ×.
 *
 * The danger tone matches the destructive Reset / DangerTab
 * banners — the consequence (data loss) is the same kind of
 * weight, even though the action here (set up a code) is
 * preventive.
 */
export function SidebarTipRecoveryCode() {
  return (
    <SidebarTip title="Important" kind="danger">
      Aucun code de récupération configuré. Sans lui, oublier ton
      mot de passe = perte de toutes tes données.{' '}
      <Link
        to="/recovery-code"
        className="cursor-pointer font-medium text-danger transition-colors hover:underline"
      >
        Configurer →
      </Link>
    </SidebarTip>
  );
}

/**
 * Specific instance: the « ajouter une passkey » nudge shown to
 * authenticated users who haven't enrolled any passkey yet. Tone is
 * `warning` (amber) — passkeys are a security upgrade rather than a
 * data-loss prevention, so a softer signal than the recovery code
 * tip is appropriate. **Dismissable** — the user can opt out of the
 * suggestion without acting on it.
 */
export function SidebarTipPasskey() {
  return (
    <SidebarTip
      title="Suggestion"
      kind="warning"
      dismissKey="nodea:home:tip-passkey"
    >
      Configure une passkey pour te connecter sans retaper ton mot de
      passe.{' '}
      <Link
        to="/passkeys"
        className="cursor-pointer font-medium text-amber-700 transition-colors hover:underline dark:text-amber-200"
      >
        Ajouter →
      </Link>
    </SidebarTip>
  );
}
