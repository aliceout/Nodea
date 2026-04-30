import type { SVGProps } from 'react';
import { cn } from '@/lib/utils';

/**
 * Nodea brand symbol — Direction A · Spirale.
 *
 * Inline monoline SVG of the open spiral (« le cycle qui ne revient
 * jamais au même point »). Uses `stroke="currentColor"` so the
 * stroke colour follows the parent's `text-*` token — passing
 * `text-accent` automatically picks up the theme's sauge in light
 * mode and clarified-sauge in dark mode without us shipping two
 * variants of the file.
 *
 * Source path matches `public/nodea-symbol-sauge.svg` 1:1 — the
 * SVG file is still served at that URL for places that consume the
 * mark as an asset (favicon links, OG images, app stores). This
 * component is for inline use inside React (sidebar, topbar, auth
 * marketing panel).
 *
 * Never fill the symbol — it's designed as a single open stroke.
 * Defaults to `aria-hidden` so a paired wordmark stays the lone
 * accessible name; pass an `aria-label` to make it stand alone
 * (e.g. when used without an adjacent "Nodea" text).
 */
interface NodeaSymbolProps extends Omit<SVGProps<SVGSVGElement>, 'viewBox' | 'fill'> {
  className?: string;
}

export default function NodeaSymbol({
  className,
  'aria-hidden': ariaHidden = true,
  ...rest
}: NodeaSymbolProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="-8 -8 116 116"
      aria-hidden={ariaHidden}
      className={cn('shrink-0', className)}
      {...rest}
    >
      <path
        d="M 50 50 m 0 -2 a 2 2 0 1 0 0 4 a 6 6 0 1 1 0 -12 a 14 14 0 1 0 0 28 a 22 22 0 1 1 0 -44 a 30 30 0 1 0 22 51"
        fill="none"
        stroke="currentColor"
        strokeWidth={6.5}
        strokeLinecap="round"
      />
    </svg>
  );
}
