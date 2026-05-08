import { useEffect, useRef } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid';

import { cn } from '@/lib/utils';

/**
 * Per-module search input rendered inside a `<Topbar>`'s right slot.
 *
 * Compact (h-8, ~240 px wide) so it sits next to the module's CTA
 * button without dominating the row. The magnifying-glass icon
 * inside the field is decorative — the field itself carries the
 * `aria-label` (callers must provide one in their language).
 *
 * The clear (X) button only renders when there's content. It
 * `clears + refocuses` so the user can keep typing after correcting
 * a wrong query. Pressing Escape inside the field has the same
 * effect, for keyboard-only users.
 *
 * Controlled component: caller owns `value` (typically the
 * `searchQuery` slice of the module's filter state).
 */
interface TopbarSearchInputProps {
  value: string;
  onChange: (next: string) => void;
  /** Visible placeholder + accessible name. Required because the
   *  field has no companion `<label>` in the Topbar layout. */
  placeholder: string;
  /** Optional override for the internal aria-label of the X button.
   *  Default: "Effacer la recherche" — callers in other locales
   *  should pass the translated string. */
  clearLabel?: string;
  /** Optional className for layout tweaks (extra width, hide on
   *  small screens, etc.). Most callers don't need this. */
  className?: string;
}

export default function TopbarSearchInput({
  value,
  onChange,
  placeholder,
  clearLabel = 'Effacer la recherche',
  className,
}: TopbarSearchInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  // Escape clears + keeps focus. Wired here rather than as `onKeyDown`
  // prop so callers don't have to thread it through.
  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape' && value.length > 0) {
      event.preventDefault();
      event.stopPropagation();
      onChange('');
    }
  }

  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  // Belt-and-braces: if a parent re-renders with a different value
  // (e.g. cleared from outside on module switch), don't fight that —
  // controlled inputs sync naturally via the `value` prop.
  useEffect(() => {
    // No-op effect kept as a documentation anchor: this component is
    // intentionally fully controlled. If you find yourself adding
    // local state here, you're probably solving the wrong problem.
  }, []);

  return (
    <div
      className={cn(
        'relative inline-flex h-8 min-w-0 items-center',
        className,
      )}
    >
      <MagnifyingGlassIcon
        className="pointer-events-none absolute left-2 h-4 w-4 text-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        // `pl-7` makes room for the magnifying-glass; `pr-7` makes
        // room for the X (when it's rendered). The search-type
        // suppresses the browser's native clear button — we own the
        // clearing UX.
        className={cn(
          'block h-8 min-h-8 w-full min-w-0 rounded-sm border border-hair bg-bg pl-7 pr-7 text-[13px] text-ink placeholder:text-muted-soft',
          'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
          // Hide the WebKit native cancel cross — we render our own.
          '[&::-webkit-search-cancel-button]:appearance-none [&::-webkit-search-decoration]:appearance-none',
        )}
      />
      {value.length > 0 ? (
        <button
          type="button"
          onClick={handleClear}
          aria-label={clearLabel}
          className="absolute right-1 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-sm text-muted hover:text-ink focus-visible:outline-none focus-visible:shadow-[0_0_0_2px_var(--color-k-accent-soft)]"
        >
          <XMarkIcon className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
