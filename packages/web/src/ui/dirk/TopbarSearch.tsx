import { useEffect, useRef, useState } from 'react';
import { MagnifyingGlassIcon, XMarkIcon } from '@heroicons/react/20/solid';

import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import TopbarSearchInput from '@/ui/dirk/TopbarSearchInput';

/**
 * Responsive module search for the topbar — drop-in replacement for a
 * bare `<TopbarSearchInput>` at the same call site.
 *
 *  - Desktop (lg+) : the inline search field, unchanged.
 *  - Mobile (<lg) : a magnifier icon in the topbar ; tapping it reveals
 *    a full-width search bar pinned under the 52 px topbar (autofocus,
 *    ✕ / Échap to collapse). Keeps the cramped 52 px row to label +
 *    burger and reveals search on intent — same posture as the
 *    speed-dial FAB.
 *
 * The collapsed magnifier tints to the accent colour while a query is
 * active, so a running filter stays discoverable without taking room.
 *
 * Échap cascades : `TopbarSearchInput` clears a non-empty query (and
 * swallows that Échap) ; a second Échap, now on an empty field, bubbles
 * up to the bar's handler and closes it.
 */
interface TopbarSearchProps {
  value: string;
  onChange: (next: string) => void;
  /** Visible placeholder + accessible name of the field. */
  placeholder: string;
  /** aria-label of the clear (✕-in-field) button. */
  clearLabel: string;
  /** aria-label of the mobile magnifier toggle. */
  openLabel: string;
  /** aria-label of the mobile close button. */
  closeLabel: string;
}

export default function TopbarSearch({
  value,
  onChange,
  placeholder,
  clearLabel,
  openLabel,
  closeLabel,
}: TopbarSearchProps) {
  const [open, setOpen] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  // On open: move focus into the field (programmatic focus on a user
  // action — not the `autoFocus` attribute jsx-a11y forbids) and wire
  // Échap to close. The Échap cascade works because TopbarSearchInput
  // stops the event only while clearing a non-empty query; once empty
  // it bubbles to this window listener.
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
      {/* Desktop : inline field. */}
      <TopbarSearchInput
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        clearLabel={clearLabel}
        className="hidden w-56 lg:inline-flex"
      />

      {/* Mobile : magnifier toggle. Accent tint flags an active query. */}
      <Button
        variant="neutral"
        size="md"
        iconOnly
        onClick={() => setOpen((o) => !o)}
        aria-label={openLabel}
        aria-expanded={open}
        className="lg:hidden"
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
          <TopbarSearchInput
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            clearLabel={clearLabel}
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
