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
 * Section scaffold for the Homepage's typographic layout. Card-style
 * chrome (rounded border on every side, soft hover shadow) matching
 * the Goals « Cartes » view so the home and the per-module surfaces
 * feel like they share the same visual idiom. The earlier hairline-
 * above-only version read more like a notebook page ; the bordered
 * card variant trades that for a clearer block-by-block separation
 * once the home has 5+ tiles fighting for attention.
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
      className={cn(
        'flex min-w-0 flex-col rounded-md border border-hair/60 bg-bg p-4 transition-shadow hover:shadow-[0_2px_8px_rgba(0,0,0,0.06)]',
        className,
      )}
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
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
