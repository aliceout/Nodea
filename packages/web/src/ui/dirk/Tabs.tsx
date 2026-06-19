import { cn } from '@/lib/utils';

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
 *   - `pill` (default) — used by Account and Admin. Active tab
 *     gets a muted card background, inactive tabs are `text-muted`
 *     with a hover lift onto the same card tone.
 *
 *   - `underline` — used by the public Docs page. Tabs fill the
 *     parent's height (so the active 2 px accent line lands on
 *     the topbar's bottom border). No background, just text +
 *     border-bottom. Place inside a `self-stretch` container for
 *     the full-height fill to take effect.
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
  const containerClass =
    variant === 'underline'
      ? 'flex h-full items-stretch gap-6'
      : '-mx-1 flex flex-wrap gap-1';

  return (
    <div className={cn(containerClass, className)} role="tablist">
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
                'cursor-pointer rounded px-3 py-[7px] text-[13px] transition-[background-color,color] duration-200',
                active
                  ? 'bg-accent-soft font-semibold text-accent-deep'
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
            className={buttonClass}
          >
            {tt.label}
          </button>
        );
      })}
    </div>
  );
}
