import type { ReactNode } from 'react';

import Button from '@/ui/atoms/dirk/Button';

import type { FeedbackState } from '../lib/types';
import Feedback from './Feedback';

interface IdentityRowProps {
  label: string;
  value: string;
  /** Shown when `value` is empty in display mode. */
  placeholder: string;
  editing: boolean;
  editLabel: string;
  submitting: boolean;
  feedback: FeedbackState | null;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  children: ReactNode;
}

/**
 * Read-by-default row with a single « Modifier … » affordance
 * that swaps the value for the row's input(s) and surfaces save /
 * cancel buttons. Each row owns its own edit lifecycle so saving
 * one field doesn't churn another (the Identity tab uses one row
 * per editable field — username, e-mail).
 */
export default function IdentityRow({
  label,
  value,
  placeholder,
  editing,
  editLabel,
  submitting,
  feedback,
  onEdit,
  onCancel,
  onSave,
  children,
}: IdentityRowProps) {
  return (
    <section className="py-[24px] first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[16px] font-semibold text-ink">{label}</h3>

      {!editing ? (
        <div className="grid grid-cols-1 items-center gap-y-3 lg:grid-cols-[170px_1fr] lg:gap-x-6">
          <div>
            <Button variant="primary" size="sm" onClick={onEdit} aria-label={editLabel}>
              Modifier
            </Button>
          </div>
          <div className="min-w-0 text-[14px] text-ink">
            {value ? (
              value
            ) : (
              <span className="italic text-muted">{placeholder || '—'}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">{children}</div>
          <div className="flex shrink-0 gap-2">
            <Button variant="primary" size="sm" onClick={onSave} disabled={submitting}>
              {submitting ? 'Enregistrement…' : 'Enregistrer'}
            </Button>
            <Button variant="danger-ghost" size="sm" onClick={onCancel} disabled={submitting}>
              Abandonner
            </Button>
          </div>
        </div>
      )}

      {feedback ? <Feedback tone={feedback.tone}>{feedback.text}</Feedback> : null}
    </section>
  );
}
