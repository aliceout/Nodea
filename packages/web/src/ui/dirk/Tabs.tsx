import { cn } from '@/lib/utils';

interface TabsProps<Id extends string> {
  tabs: ReadonlyArray<{ id: Id; label: string }>;
  value: Id;
  onChange: (next: Id) => void;
  className?: string;
}

/**
 * Inline tab switcher — Direction K · Sauge.
 *
 * Used by Account and Admin for their top-level section switching.
 * The active tab gets a muted card background; inactive tabs are
 * `text-muted` with a hover lift onto the same card tone.
 *
 * Generic on the id union so consumers preserve their narrow tab
 * type end-to-end (no string-cast on `onChange`).
 */
export default function Tabs<Id extends string>({
  tabs,
  value,
  onChange,
  className,
}: TabsProps<Id>) {
  return (
    <div className={cn('-mx-1 flex flex-wrap gap-1', className)} role="tablist">
      {tabs.map((tt) => {
        const active = value === tt.id;
        return (
          <button
            key={tt.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tt.id)}
            data-active={active}
            className={cn(
              'rounded-md px-3 py-[7px] text-[13px] transition-[background-color,color] duration-200',
              active
                ? 'bg-bg-2 font-semibold text-ink'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            {tt.label}
          </button>
        );
      })}
    </div>
  );
}
