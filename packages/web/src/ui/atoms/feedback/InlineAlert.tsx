import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type InlineAlertTone = 'danger' | 'success' | 'warning';

interface InlineAlertProps {
  /** Visual + semantic register. `danger` is the default — the
   *  pattern this atom replaces showed up almost exclusively as
   *  red error banners. `success` is the green matching tone for
   *  one-shot confirmations (« Compte activé », « Mot de passe mis
   *  à jour »). `warning` covers the amber variant used for
   *  recovery-flow nudges. */
  tone?: InlineAlertTone;
  /** ARIA role — defaults to `alert` for `danger` / `warning` and
   *  `status` for `success`, matching the way assistive tech treats
   *  each: errors interrupt, confirmations are polite. Override
   *  when the call site has a more specific intent. */
  role?: 'alert' | 'status';
  className?: string;
  children: ReactNode;
}

/**
 * Hairline-bordered inline alert used everywhere a form / page
 * needs to flag an error or a one-shot success right next to the
 * thing the user just touched. Direction K · Sauge baseline:
 * 2-px left border, 5 %-tinted bg, 13-px text in the matching
 * tone — chassis is the same regardless of severity, only the
 * colour token swaps.
 */
const TONE_CLASS: Record<InlineAlertTone, string> = {
  danger: 'border-danger bg-danger/5 text-danger',
  success: 'border-accent bg-accent/5 text-accent-deep',
  warning:
    'border-amber-500 bg-amber-500/10 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200',
};

export default function InlineAlert({
  tone = 'danger',
  role,
  className,
  children,
}: InlineAlertProps) {
  const resolvedRole = role ?? (tone === 'success' ? 'status' : 'alert');
  return (
    <div
      role={resolvedRole}
      className={cn(
        'border-l-2 px-3 py-2 text-[13px]',
        TONE_CLASS[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}
