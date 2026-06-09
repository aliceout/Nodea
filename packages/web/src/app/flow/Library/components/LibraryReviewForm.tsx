import { useState } from 'react';
import {
  LIBRARY_REVIEW_KIND_VALUES,
  type LibraryReviewKind,
  type LibraryReviewPayload,
} from '@nodea/shared';

import { libraryReviewsClient } from '@/core/api/modules/library';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import DirkInput from '@/ui/atoms/dirk/Input';

import MarkdownEditor from '@/ui/dirk/forms/MarkdownEditor';
import { submitOnCmdEnter } from '@/ui/dirk/forms/format';

import type { LibraryItem, LibraryReview } from '../lib/types';

interface LibraryReviewFormProps {
  /** When set, the form edits this review. The kind / page / content
   *  are pre-filled and the date stays the original `payload.date`. */
  initial?: LibraryReview;
  /** When creating a fresh review, this carries the parent book id +
   *  the picker-chosen kind (note / quote). Ignored on edit (the
   *  parent comes from `initial.itemRid`). */
  create?: { itemRid: string; kind: LibraryReviewKind };
  /** Parent book being attached to — surfaced as a discreet caption
   *  above the form so the user can confirm before saving. Looked up
   *  by the caller from `data.items` ; the form itself doesn't need
   *  the item list. */
  parentItem: LibraryItem | undefined;
  onClose: () => void;
}

/**
 * Library review form — inline composer rendered inside Library's
 * `ReviewsList` (above the list) when `formOpen` is true on the
 * actions context.
 *
 * Reuses the shared `MarkdownEditor` from `@/ui/dirk/forms/`
 * + the kind / page widgets. A review always needs a parent book :
 * in create mode the picker provides the `create.itemRid`, in edit
 * mode `initial.itemRid` is the source of truth.
 */
export default function LibraryReviewForm({
  initial,
  create,
  parentItem,
  onClose,
}: LibraryReviewFormProps) {
  const { t } = useI18n();
  const ctx = useModuleClient('library');
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);

  const isEdit = initial !== undefined;
  const itemRid = initial?.itemRid ?? create?.itemRid ?? '';

  const [kind, setKind] = useState<LibraryReviewKind>(
    initial?.kind ?? create?.kind ?? 'note',
  );
  const [page, setPage] = useState(initial?.page ? String(initial.page) : '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError(t('library.reviewForm.contentRequired'));
      return;
    }
    if (!itemRid) {
      setError(t('library.reviewForm.noParent'));
      return;
    }
    if (!ctx) {
      setError(t('library.errors.notConfigured'));
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = isEdit
        ? (initial?.date ?? new Date().toISOString())
        : new Date().toISOString();
      const payload: LibraryReviewPayload = {
        itemRid,
        date: dateIso,
        kind,
        // The form has no title field — preserve whatever the
        // record carries (imports can set one) instead of nulling
        // it on every edit (audit 2026-06).
        title: initial?.title ?? null,
        content: trimmedContent,
        page: page ? Number(page) : null,
        spoiler: initial?.spoiler ?? false,
      };
      if (isEdit && initial) {
        await libraryReviewsClient.update(
          ctx.moduleUserId,
          ctx.mainKey,
          initial.id,
          payload,
        );
      } else {
        await libraryReviewsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      }
      bumpReviewsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t('library.errors.saveFailed'),
      );
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSave();
      }}
      className="mb-5 rounded-md border border-hair bg-bg-2 p-4"
      noValidate
    >
      {/* Parent book caption — gives the user a quick read on which
          book the review attaches to before they commit. Stays muted
          ; the writing surface is what matters. */}
      {parentItem ? (
        <p className="mb-3 text-[11.5px] text-muted">
          {t('library.reviewForm.captionPrefix')}{' '}
          <span className="font-medium text-ink-soft">
            {t('library.reviewForm.captionTitle', {
              values: { title: parentItem.title },
            })}
          </span>
          {parentItem.creators?.[0]?.name
            ? ` · ${parentItem.creators[0].name}`
            : ''}
        </p>
      ) : null}

      <div className="space-y-3">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_120px]">
          <div className="grid grid-cols-2 gap-1.5">
            {LIBRARY_REVIEW_KIND_VALUES.map((k) => {
              const active = kind === k;
              return (
                <button
                  key={k}
                  type="button"
                  onClick={() => setKind(k)}
                  aria-pressed={active}
                  disabled={submitting}
                  className={cn(
                    'h-8 cursor-pointer rounded-[var(--radius-input)] border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    active
                      ? 'border-accent bg-accent font-semibold text-white'
                      : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                  )}
                >
                  {t(`library.reviewKind.${k}`)}
                </button>
              );
            })}
          </div>
          <DirkInput
            inputMode="numeric"
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder={t('library.reviewForm.pagePlaceholder')}
            aria-label={t('library.reviewForm.pagePlaceholder')}
            aria-describedby={error ? 'library-review-form-error' : undefined}
            disabled={submitting}
            align="center"
          />
        </div>

        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSubmit={handleSave}
          disabled={submitting}
          mode={editorMode}
          onModeChange={setEditorMode}
          {...(error ? { ariaDescribedBy: 'library-review-form-error' } : {})}
        />
      </div>

      {error ? (
        <p id="library-review-form-error" role="alert" className="mt-3 text-[12px] text-danger">
          {error}
        </p>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <Button
          type="button"
          variant="neutral"
          size="sm"
          onClick={onClose}
          disabled={submitting}
        >
          {t('common.actions.cancel')}
        </Button>
        <Button type="submit" variant="primary" size="sm" disabled={submitting}>
          {submitting
            ? isEdit
              ? t('common.states.updating')
              : t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
