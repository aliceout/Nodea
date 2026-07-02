import { cn, FOCUS_RING } from '@/lib/utils';

import { useSlidingIndicator } from './use-sliding-indicator';

export type TabsVariant = 'pill' | 'underline';

interface TabsProps<Id extends string> {
  tabs: ReadonlyArray<{ id: Id; label: string }>;
  value: Id;
  onChange: (next: Id) => void;
  className?: string;
  /** Visual style. `pill` (default) is the inline card-tab used by
   *  Account / Admin. `underline` is full-height with a 2 px
   *  accent line on the active tab — designed to sit in a topbar
   *  so its underline lands on the topbar's hairline. */
  variant?: TabsVariant;
}

/**
 * Tab switcher — Direction K · Sauge.
 *
 * Two visual variants:
 *
 *   - `pill` (default) — used by Account and Admin. The active tab's
 *     card background is a SINGLE shared element that glides to the
 *     clicked tab (measured from the active button, moved via a
 *     transform transition) rather than one background per button
 *     popping on/off. The buttons sit above it (`z-10`, transparent)
 *     and only their text colour changes.
 *
 *   - `underline` — used by the public Docs page. Tabs fill the
 *     parent's height (so the active 2 px accent line lands on
 *     the topbar's bottom border). No background, just text +
 *     border-bottom; no sliding indicator (kept instant).
 *
 * The slide is measured in a layout effect (active button's
 * offset box) and re-measured on tab change, label/locale change
 * (the `tabs` dep) and container resize (a `ResizeObserver`). It
 * stays put for `prefers-reduced-motion` via `motion-reduce`.
 *
 * Generic on the id union so consumers preserve their narrow tab
 * type end-to-end (no string-cast on `onChange`).
 */
export default function Tabs<Id extends string>({
  tabs,
  value,
  onChange,
  className,
  variant = 'pill',
}: TabsProps<Id>) {
  // A single sliding pill (pill variant only); underline keeps its
  // per-button border. The active value animates; label/variant changes
  // (which only resize the pill) snap.
  const { ref, state } = useSlidingIndicator(
    String(value),
    `${variant}|${tabs.map((tt) => tt.label).join('|')}`,
    variant === 'pill' ? '[data-active="true"]' : '',
  );

  const containerClass =
    variant === 'underline'
      ? 'flex h-full items-stretch gap-6'
      : 'relative -mx-1 flex flex-wrap gap-1';

  return (
    <div ref={ref} className={cn(containerClass, className)} role="tablist">
      {variant === 'pill' && state ? (
        <span
          aria-hidden="true"
          className={cn(
            // `transition-property` stays set; only the duration toggles, so
            // a switch never depends on a transition added in the same frame.
            'pointer-events-none absolute left-0 top-0 rounded bg-accent-soft transition-[transform,width] ease-[cubic-bezier(0.2,0.7,0.3,1)] motion-reduce:transition-none',
            state.animate ? 'duration-300' : 'duration-0',
          )}
          style={{
            transform: `translate(${state.rect.left}px, ${state.rect.top}px)`,
            width: state.rect.width,
            height: state.rect.height,
          }}
        />
      ) : null}
      {tabs.map((tt) => {
        const active = value === tt.id;
        const buttonClass =
          variant === 'underline'
            ? cn(
                'inline-flex h-full cursor-pointer items-center border-b-2 px-1 text-[13px] transition-colors duration-200',
                active
                  ? 'border-accent font-semibold text-ink'
                  : 'border-transparent text-muted hover:text-ink',
              )
            : cn(
                'relative z-10 cursor-pointer rounded px-3 py-1 text-[13px] transition-colors duration-200',
                active
                  ? 'font-semibold text-accent-deep'
                  : 'text-muted hover:bg-bg-2 hover:text-ink',
              );
        return (
          <button
            key={tt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tt.id)}
            data-active={active}
            className={cn(buttonClass, FOCUS_RING)}
          >
            {tt.label}
          </button>
        );
      })}
    </div>
  );
}
