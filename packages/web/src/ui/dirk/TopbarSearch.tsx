import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

/**
 * THE per-module topbar search — one component for both breakpoints,
 * rendered ONCE per page via `<Topbar search={…}>`:
 *
 *   - desktop (≥ lg): an inline field that fills the topbar's left
 *     `search` slot up to `className`'s max-width;
 *   - mobile (< lg): a magnifier pinned to the right of the slot that
 *     reveals a full-width bar under the 52 px topbar (autofocus, ✕ /
 *     Échap to collapse). The magnifier tints to accent while a query
 *     is active.
 *
 * Controlled : the caller owns `value` (the module's search filter
 * slice). The desktop field and the mobile drawer share one private
 * `SearchField` so there's a single input implementation.
 *
 * Échap cascade : the field clears a non-empty query (swallowing that
 * Échap) ; a second Échap on an empty field bubbles to the bar's
 * handler and closes it.
 */
interface TopbarSearchProps {
  value: string;
  onChange: (next: string) => void;
  /** Visible placeholder + accessible name (the field has no `<label>`). */
  placeholder: string;
  /** aria-label of the clear (✕) button. Defaults to the translated
   *  `common.search.clearAria`. */
  clearLabel?: string;
  /** aria-label of the mobile magnifier toggle. */
  openLabel: string;
  /** aria-label of the mobile close button. */
  closeLabel: string;
  /** Layout className for the desktop field — typically its max-width. */
  className?: string;
}

/** Controlled field + inline clear/Échap, shared by the desktop slot
 *  and the mobile drawer. Private to this file — the whole module owns
 *  exactly one search component. */
function SearchField({
  value,
  onChange,
  placeholder,
  clearLabel,
  className,
}: {
  value: string;
  onChange: (next: string) => void;
  placeholder: string;
  clearLabel: string;
  className?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape' && value.length > 0) {
      e.preventDefault();
      e.stopPropagation();
      onChange('');
    }
  }
  function handleClear() {
    onChange('');
    inputRef.current?.focus();
  }

  return (
    <div className={cn('relative inline-flex h-8 min-w-0 items-center', className)}>
      <MagnifyingGlassIcon
        className="pointer-events-none absolute left-2 h-4 w-4 text-muted"
        aria-hidden="true"
      />
      <input
        ref={inputRef}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        aria-label={placeholder}
        className={cn(
          'block h-8 min-h-8 w-full min-w-0 rounded-sm border border-hair bg-bg pl-7 pr-7 text-[13px] text-ink placeholder:text-muted-soft',
          'focus:border-accent focus:shadow-[0_0_0_3px_var(--color-k-accent-soft)] focus:outline-none',
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

export default function TopbarSearch({
  value,
  onChange,
  placeholder,
  clearLabel,
  openLabel,
  closeLabel,
  className,
}: TopbarSearchProps) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const resolvedClearLabel = clearLabel ?? t('common.search.clearAria');

  // On open: focus the field (programmatic, not the `autoFocus` attr
  // jsx-a11y forbids) and wire Échap to close. The Échap cascade works
  // because SearchField stops the event only while clearing a non-empty
  // query; once empty it bubbles to this window listener.
  useEffect(() => {
    if (!open) return;
    barRef.current?.querySelector('input')?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      {/* Desktop : inline field filling the slot up to its max-width. */}
      <SearchField
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        clearLabel={resolvedClearLabel}
        className={cn('hidden w-full lg:inline-flex', className)}
      />

      {/* Mobile : magnifier pushed to the right of the slot. */}
      <Button
        variant="neutral"
        size="md"
        iconOnly
        onClick={() => setOpen((o) => !o)}
        aria-label={openLabel}
        aria-expanded={open}
        className="ml-auto lg:hidden"
      >
        <MagnifyingGlassIcon
          className={cn('h-5 w-5', value ? 'text-accent' : 'text-ink-soft')}
          aria-hidden="true"
        />
      </Button>

      {/* Mobile : full-width bar pinned under the topbar when open. */}
      {open ? (
        <div
          ref={barRef}
          className="animate-fade-up fixed inset-x-0 top-[52px] z-20 flex items-center gap-2 border-b border-hair bg-bg px-6 py-2 sm:px-9 lg:hidden"
        >
          <SearchField
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            clearLabel={resolvedClearLabel}
            className="w-full"
          />
          <Button
            variant="ghost"
            size="md"
            iconOnly
            onClick={() => setOpen(false)}
            aria-label={closeLabel}
          >
            <XMarkIcon className="h-5 w-5" aria-hidden="true" />
          </Button>
        </div>
      ) : null}
    </>
  );
}
