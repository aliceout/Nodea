import type { ReactNode } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import DirkButton from '@/ui/atoms/dirk/Button';

interface FooterProps {
  onSubmit: () => void;
  submitting?: boolean;
  error?: string | null;
  /** Submit copy. Defaults to `common.actions.save`. Pass an
   *  override only when the body has a non-save semantic (« Mettre
   *  à jour », « Confirmer »…). */
  submitLabel?: string;
  /** Optional override for the in-flight label. Defaults to
   *  `common.states.saving`. */
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
 * `submittingLabel`. Defaults flow through `common.actions.save`
 * + `common.states.saving` so a wording change in `common.json`
 * propagates everywhere.
 */
export default function Footer({
  onSubmit,
  submitting,
  error,
  submitLabel,
  submittingLabel,
  extra,
}: FooterProps) {
  const { t } = useI18n();
  const submit = submitLabel ?? t('common.actions.save');
  const inFlight = submittingLabel ?? t('common.states.saving');
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
            {t('modals.composer.kbdSend')}
          </span>
          <span className="hidden items-center gap-1.5 sm:inline-flex">
            <kbd className="rounded-[3px] border border-hair bg-bg px-1.5 py-px font-mono text-[10px] text-ink-soft">
              esc
            </kbd>
            {t('modals.composer.kbdCancel')}
          </span>
          <span>{t('modals.composer.encryptedLocally')}</span>
        </div>
        <div className="flex items-center gap-2">
          {extra}
          <DirkButton
            variant="primary"
            size="sm"
            onClick={onSubmit}
            disabled={submitting}
          >
            {submitting ? inFlight : submit}
          </DirkButton>
        </div>
      </div>
    </div>
  );
}
