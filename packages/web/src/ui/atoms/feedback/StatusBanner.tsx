import clsx from 'clsx';
import type { HTMLAttributes, ReactNode } from 'react';

type Tone = 'success' | 'error' | 'info';

const toneStyles: Record<Tone, string> = {
  success: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  error: 'border-rose-200 bg-rose-50 text-rose-700',
  info: 'border-sky-200 bg-sky-50 text-sky-700',
};

interface StatusBannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: Tone;
  children?: ReactNode;
}

/**
 * Generic status banner. `role` defaults to `alert` when the tone is
 * `error`, `status` otherwise — callers can override explicitly.
 */
export default function StatusBanner({
  tone = 'info',
  children,
  className = '',
  role,
  ...props
}: StatusBannerProps) {
  const resolvedTone: Tone = toneStyles[tone] ? tone : 'info';
  const ariaRole = role ?? (resolvedTone === 'error' ? 'alert' : 'status');

  return (
    <div
      role={ariaRole}
      aria-live={ariaRole === 'alert' ? 'assertive' : 'polite'}
      className={clsx(
        'w-full rounded-md border p-3 text-sm text-center',
        toneStyles[resolvedTone],
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
