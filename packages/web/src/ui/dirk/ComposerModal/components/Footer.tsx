import type { ReactNode } from 'react';

import DirkButton from '@/ui/atoms/dirk/Button';

interface FooterProps {
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
  submitLabel?: string;
  submittingLabel?: string;
  /** Optional element rendered between the keyboard hints and
   *  the submit button — e.g. a body-specific toggle like
   *  Journal's « Aperçu » switch. Kept generic so other
   *  bodies can opt in later. */
  extra?: ReactNode;
}

/**
 * Sticky footer at the bottom of every Composer body. Two
 * surfaces stacked :
 *
 *   - **Error banner** (only when `error` is non-null) — full
 *     width, danger tone, `role="alert"` so screen readers
 *     pick it up.
 *   - **Action row** — keyboard hints (⌘↵ / esc) + the
 *     « chiffré localement » reassurance on the left, the
 *     optional `extra` slot + the primary submit button on the
 *     right.
 *
 * Each body decides its own submit copy via `submitLabel` /
 * `submittingLabel` (the defaults are « Enregistrer » /
 * « Enregistrement… »).
 */
export default function Footer({
  onSubmit,
  submitting,
  error,
  submitLabel = 'Enregistrer',
  submittingLabel = 'Enregistrement…',
  extra,
}: FooterProps) {
  return (
    <div className="border-t border-hair bg-bg-2">
      {error ? (
        <p
          role="alert"
          className="border-b border-hair bg-danger/5 px-3.5 py-1.5 text-[12px] text-danger"
        >
          {error}
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-4 px-3.5 py-2.5">
        <div className="flex items-center gap-4 text-[11px] text-muted">
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded-[3px] border border-hair bg-bg px-1.5 py-px font-mono text-[10px] text-ink-soft">
              ⌘↵
            </kbd>
            envoyer
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded-[3px] border border-hair bg-bg px-1.5 py-px font-mono text-[10px] text-ink-soft">
              esc
            </kbd>
            annuler
          </span>
          <span>chiffré localement</span>
        </div>
        <div className="flex items-center gap-2">
          {extra}
          <DirkButton
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? submittingLabel : submitLabel}
          </DirkButton>
        </div>
      </div>
    </div>
  );
}
