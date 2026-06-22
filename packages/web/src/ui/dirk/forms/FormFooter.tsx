import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

/**
 * The Cancel / Submit footer every inline form repeats — a neutral
 * Cancel + a primary Submit, both `size="sm"` and disabled while
 * submitting. Factored from 9 byte-identical copies (Mood, Goals,
 * Journal, Library×2, HRT×4) per the « third copy » rule.
 *
 * The submit label is passed already-resolved so each form keeps its own
 * wording (save vs add vs « Enregistrement… » while pending). The
 * container layout is overridable via `className` (JournalForm tucks the
 * pair into its attachments row with `ml-auto flex gap-2` instead of the
 * default right-aligned footer).
 */
interface FormFooterProps {
  /** Already-resolved submit button text (caller handles edit/pending). */
  submitLabel: string;
  onCancel: () => void;
  submitting: boolean;
  /** Defaults to `common.actions.cancel`. */
  cancelLabel?: string;
  /** Full override of the footer container classes. Default:
   *  `mt-4 flex justify-end gap-2`. */
  className?: string;
}

export default function FormFooter({
  submitLabel,
  onCancel,
  submitting,
  cancelLabel,
  className,
}: FormFooterProps) {
  const { t } = useI18n();
  return (
    <div className={className ?? 'mt-4 flex justify-end gap-2'}>
      <Button
        type="button"
        variant="neutral"
        size="sm"
        onClick={onCancel}
        disabled={submitting}
      >
        {cancelLabel ?? t('common.actions.cancel')}
      </Button>
      <Button type="submit" variant="primary" size="sm" disabled={submitting}>
        {submitLabel}
      </Button>
    </div>
  );
}
