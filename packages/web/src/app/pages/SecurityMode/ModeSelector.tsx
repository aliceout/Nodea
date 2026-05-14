import type { SecurityMode } from '@nodea/shared';

import { cn } from '@/lib/utils';

interface ModeOption {
  id: SecurityMode;
  label: string;
  description: string;
  /** When non-null, the mode can't be selected — the message tells
   *  the user what to do first. */
  unmetRequirement: string | null;
}

/**
 * Three-card mode picker (REFACTO-12 split). Cards whose
 * prerequisites are unmet (e.g. « Active TOTP avant ») are
 * disabled with a helper line ; clicking a card calls
 * `onSelect(mode)`. The currently-active mode is marked « Actif ».
 *
 * The list of options + their `unmetRequirement` strings are
 * computed by the parent (which has access to the user's flags
 * via the store) and passed in as `options`. Keeping the
 * derivation in the parent avoids a second store subscription
 * here.
 */
export default function ModeSelector({
  options,
  currentMode,
  selected,
  onSelect,
}: {
  options: ReadonlyArray<ModeOption>;
  currentMode: SecurityMode;
  selected: SecurityMode | null;
  onSelect: (mode: SecurityMode) => void;
}) {
  return (
    <div className="mb-3 grid gap-2">
      {options.map((opt) => {
        const isCurrent = opt.id === currentMode;
        const isSelected = opt.id === selected;
        const isLocked = opt.unmetRequirement !== null && !isCurrent;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onSelect(opt.id)}
            disabled={isLocked}
            aria-pressed={isCurrent}
            className={cn(
              'group flex flex-col items-start rounded-md border px-3 py-2.5 text-left transition-colors',
              isCurrent
                ? 'border-accent bg-accent/5'
                : isSelected
                  ? 'border-ink-soft bg-bg-2'
                  : 'border-hair bg-bg hover:bg-bg-2',
              isLocked && 'cursor-not-allowed opacity-60 hover:bg-bg',
            )}
          >
            <div className="mb-1 flex w-full items-center justify-between gap-2">
              <span className="text-[13.5px] font-semibold text-ink">
                {opt.label}
              </span>
              {isCurrent ? (
                <span className="rounded-sm bg-accent px-1.5 py-px text-[10px] font-semibold uppercase tracking-[0.04em] text-white">
                  Actif
                </span>
              ) : null}
            </div>
            <p className="text-[12px] leading-[1.45] text-ink-soft">
              {opt.description}
            </p>
            {opt.unmetRequirement && !isCurrent ? (
              <p className="mt-1.5 text-[11.5px] text-amber-700 dark:text-amber-200">
                {opt.unmetRequirement}
              </p>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

export type { ModeOption };
