import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type GroupBlockVariant = 'subtitle' | 'eyebrow';

interface GroupBlockProps {
  label: string;
  count: number;
  /** Singular noun (« entrée », « objectif », « livre »). The atom
   *  appends « s » when count !== 1. */
  countNoun: string;
  /** Header style:
   *  - `subtitle` (default) — 15-px tight-tracking ink. Used when
   *    the group label is a user-facing title (thread name, year).
   *    Pairs with `mb-9` between groups so titles get room to
   *    breathe.
   *  - `eyebrow` — 12-px uppercase muted. Used when the label is
   *    meta categorisation (status filter, status bucket). Pairs
   *    with the slightly tighter `mb-7`. */
  variant?: GroupBlockVariant;
  /** Wrapper tag for the children block. Default `ul` keeps the
   *  semantic « list of items » signal. Set to `div` when the
   *  children are virtualized (`VirtualWindowList`), because the
   *  virtualizer wraps each item in an absolutely-positioned `div`
   *  that's invalid as a direct child of `<ul>`. The accessibility
   *  trade-off (no « item N of M » announcement on virtualized
   *  groups) is acceptable since the lists that need virtualization
   *  are also the ones where item-of-count narration would just be
   *  noise. */
  listTag?: 'ul' | 'div';
  /** Hairline under the label row. Default `true` because that's
   *  the look the row-list surfaces (Mood / Journal / Goals list /
   *  Library) lean on : the hairline echoes the per-row dividers
   *  below it. Set to `false` in card-grid surfaces (Goals cards)
   *  where the cards already carry their own border on every side,
   *  so the extra horizontal line under the label reads as noise.
   */
  bordered?: boolean;
  children: ReactNode;
  className?: string;
}

const HEADER_CLASS: Record<GroupBlockVariant, string> = {
  subtitle: 'text-[15px] font-semibold tracking-[-0.005em] text-ink',
  eyebrow:
    'text-[12px] font-semibold uppercase tracking-[0.04em] text-muted',
};

const WRAPPER_CLASS: Record<GroupBlockVariant, string> = {
  subtitle: 'mb-9',
  eyebrow: 'mb-7',
};

/**
 * Group-of-rows block — a hairline-bordered header that pairs a
 * label (left) with a count + noun (right), then renders a `<ul>`
 * of children below. Used by Mood / Journal / Goals / Library to
 * organise their entries lists by thread / status / year.
 *
 * The variant tag picks between two visual registers (subtitle vs
 * eyebrow) and ties spacing to it so the call site never has to
 * tune the margin to match.
 */
export default function GroupBlock({
  label,
  count,
  countNoun,
  variant = 'subtitle',
  listTag = 'ul',
  bordered = true,
  children,
  className,
}: GroupBlockProps) {
  const plural = count !== 1 ? `${countNoun}s` : countNoun;
  const ListTag = listTag;
  return (
    <div className={cn(WRAPPER_CLASS[variant], 'last:mb-0', className)}>
      <div
        className={cn(
          'mb-2 flex items-baseline justify-between pb-1.5',
          bordered && 'border-b border-hair',
        )}
      >
        <h2 className={HEADER_CLASS[variant]}>{label}</h2>
        <span className="text-[11px] tabular-nums text-muted">
          {count} {plural}
        </span>
      </div>
      <ListTag>{children}</ListTag>
    </div>
  );
}
