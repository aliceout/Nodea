import { useEffect, useRef, useState } from 'react';

import { cn } from '@/lib/utils';
import DirkButton from '@/ui/atoms/dirk/Button';

import { SEARCH_MODE_LABEL } from '@/ui/dirk/forms/constants';

interface SearchButtonProps {
  searching: boolean;
  disabled: boolean;
  title: string | undefined;
  onSearch: () => void;
  /** Mode dropdown — only rendered when both `mode` and
   *  `onModeChange` are provided. Surfaced as a small `▾`
   *  split attached to the right of the « Chercher » button. */
  mode: 'all' | 'cover-only' | undefined;
  onModeChange: ((next: 'all' | 'cover-only') => void) | undefined;
}

/**
 * Split-button « Chercher » with an optional mode dropdown
 * attached. The main click runs the search with whatever mode
 * is currently selected ; the small `▾` on the right opens a
 * popover that lets the user pick between « Métadonnées +
 * couverture » (the default, applies the full payload of a
 * picked result) and « Couverture seule » (applies only the
 * cover URL — used to refresh the cover of an existing book
 * without losing typed metadata).
 *
 * On the create path no mode is passed → the split disappears,
 * the button stays a regular « Chercher ».
 */
export default function SearchButton({
  searching,
  disabled,
  title,
  onSearch,
  mode,
  onModeChange,
}: SearchButtonProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Click outside closes the popover. Pointer-down catches the
  // press on the trigger button itself (which would otherwise
  // toggle on click and immediately re-close from this
  // listener).
  useEffect(() => {
    if (!open) return undefined;
    function handle(e: MouseEvent): void {
      if (!containerRef.current) return;
      if (containerRef.current.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  const hasMenu = mode !== undefined && onModeChange !== undefined;

  return (
    <div ref={containerRef} className="relative inline-flex">
      <DirkButton
        variant="primary"
        onClick={onSearch}
        disabled={disabled}
        title={title}
        className={hasMenu ? 'rounded-r-none' : undefined}
      >
        {searching ? '…' : 'Chercher'}
      </DirkButton>
      {hasMenu ? (
        <>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            disabled={searching}
            aria-haspopup="menu"
            aria-expanded={open}
            aria-label="Choisir ce qui sera appliqué"
            title={SEARCH_MODE_LABEL[mode]}
            className={cn(
              'inline-flex h-9 shrink-0 cursor-pointer items-center justify-center rounded-l-none rounded-r-md bg-accent px-2 text-white font-semibold transition-[background-color,color] duration-150',
              'shadow-[inset_1px_0_0_rgba(255,255,255,0.25)]',
              'hover:bg-accent-hover focus:outline-none disabled:cursor-not-allowed disabled:opacity-60',
            )}
          >
            <span aria-hidden="true" className="text-[11px] leading-none">
              ▾
            </span>
          </button>
          {open ? (
            <div
              role="menu"
              className="absolute right-0 top-full z-30 mt-1 min-w-[200px] rounded-md border border-hair bg-bg p-1 shadow-[0_8px_24px_rgba(0,0,0,0.12)]"
            >
              {(['all', 'cover-only'] as const).map((opt) => {
                const active = mode === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    role="menuitemradio"
                    aria-checked={active}
                    onClick={() => {
                      onModeChange(opt);
                      setOpen(false);
                    }}
                    className={cn(
                      'block w-full cursor-pointer rounded-sm px-2.5 py-1.5 text-left text-[12px] transition-colors',
                      active
                        ? 'bg-accent-soft font-semibold text-accent-deep'
                        : 'text-ink hover:bg-bg-2',
                    )}
                  >
                    {SEARCH_MODE_LABEL[opt]}
                  </button>
                );
              })}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
