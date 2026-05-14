import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HomeCardProps {
  /** Small uppercase eyebrow at the top-left. Caller composes the
   *  count + noun (e.g. `"14 J · MOOD"`, `"GOALS · 5 EN COURS"`)
   *  so each section reads in two beats : window + topic. */
  title: string;
  /** Right-aligned summary on the same baseline as the eyebrow
   *  (e.g. `"moyenne +0.8"`, `"8 jours"`). */
  trailing?: ReactNode;
  /** Trailing link (« tout voir → »), rendered after `trailing`
   *  with a thin dot separator. */
  cta?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Section scaffold for the Homepage's typographic layout. No
 * card chrome (no bg, no rounded border, no shadow) — the visual
 * rhythm comes from a single hairline rule above each section
 * plus generous vertical padding. The home reads as a page of a
 * notebook, not a dashboard.
 *
 * The eyebrow + trailing baseline pattern is the page's main
 * shape : every block opens with `{count} · {NOUN}` left and the
 * one-line summary + « tout voir → » right. Anything inside is
 * the caller's responsibility — frise, strip, list, etc.
 */
export default function HomeCard({
  title,
  trailing,
  cta,
  children,
  className,
}: HomeCardProps) {
  return (
    <section
      className={cn('min-w-0 border-t border-hair pt-4 pb-1', className)}
    >
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-muted">
          {title}
        </h3>
        {trailing || cta ? (
          <div className="flex shrink-0 items-baseline gap-2 text-[11px] text-muted">
            {trailing}
            {trailing && cta ? <span aria-hidden="true">·</span> : null}
            {cta}
          </div>
        ) : null}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}
