import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface HomeCardProps {
  /** Small uppercase label rendered at the top-left. */
  title: string;
  /** Optional right-aligned summary (number, average, count…)
   *  rendered next to the title. Keeps an at-a-glance read on
   *  the card without scanning the body. */
  trailing?: ReactNode;
  /** Optional small CTA / link rendered below `trailing` on a
   *  second baseline (e.g. « tout voir → »). */
  cta?: ReactNode;
  /** Visual density. `'cosy'` (default) is the magazine card
   *  rhythm ; `'tight'` removes the inner padding for cards that
   *  embed a wide viz that should bleed to the edges. */
  density?: 'cosy' | 'tight';
  children: ReactNode;
  className?: string;
}

/**
 * Card chrome shared by every Homepage block under the hero
 * (Mood frise, reading list, journal strip, goals…). One source
 * of truth for the rounded hairline, the padding rhythm, and the
 * title row's typography so the grid reads as a coherent set.
 *
 * The chrome stays restrained on purpose : just a soft `bg-bg-2`
 * with a hairline border. Cards aren't shadowed — Nodea's home
 * is more « pages of a notebook » than « web app dashboard »,
 * shadows would push it the wrong way.
 */
export default function HomeCard({
  title,
  trailing,
  cta,
  density = 'cosy',
  children,
  className,
}: HomeCardProps) {
  return (
    <section
      className={cn(
        'flex min-w-0 flex-col rounded-lg border border-hair bg-bg-2',
        density === 'cosy' ? 'p-5' : 'pt-5',
        className,
      )}
    >
      <header
        className={cn(
          'mb-3 flex items-baseline justify-between gap-3',
          density === 'tight' && 'px-5',
        )}
      >
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          {title}
        </h3>
        <div className="flex shrink-0 items-baseline gap-3">
          {trailing}
          {cta}
        </div>
      </header>
      <div className="min-w-0 flex-1">{children}</div>
    </section>
  );
}
