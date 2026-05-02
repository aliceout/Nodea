import { useState } from 'react';
import {
  LIBRARY_REVIEW_KIND_VALUES,
  type LibraryReviewKind,
} from '@nodea/shared';

import { libraryReviewsClient } from '@/core/api/modules/library';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import DirkInput from '@/ui/atoms/dirk/Input';

import Footer from '../components/Footer';
import MarkdownEditor from '../components/MarkdownEditor';
import { LIBRARY_REVIEW_KIND_LABEL } from '../lib/constants';
import { submitOnCmdEnter } from '../lib/format';

interface LibraryReviewBodyProps {
  onClose: () => void;
}

/**
 * Library review form — a note or extract attached to an item.
 * Reuses the shared `MarkdownEditor` (visual mode + Markdown
 * source toggle) so the writing experience matches the rest of
 * the app.
 *
 * `kind` distinguishes a `quote` (extract from the book, often
 * with a page number) from a `note` (in-progress reflection or
 * fiche-bilan). The detail page renders them differently.
 *
 * The review *requires* a parent item — the Library page
 * passes the item id via `composer.editing.payload.itemRid`
 * even on creation (otherwise we'd have a dangling review).
 */
export default function LibraryReviewBody({ onClose }: LibraryReviewBodyProps) {
  const { t } = useI18n();
  const ctx = useModuleClient('library');
  const bumpReviewsVersion = useNodeaStore((s) => s.bumpLibraryReviewsVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'library-review'
      ? s.composer.editing
      : null,
  );

  const editingPayload = editing?.payload;
  const itemRid = editingPayload?.itemRid ?? '';
  const isEditExisting = editing !== null && (editing.id?.length ?? 0) > 0;

  const [kind, setKind] = useState<LibraryReviewKind>(editingPayload?.kind ?? 'note');
  const [page, setPage] = useState(editingPayload?.page ? String(editingPayload.page) : '');
  const [content, setContent] = useState(editingPayload?.content ?? '');
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedContent = content.trim();
    if (!trimmedContent) {
      setError('Le contenu est requis.');
      return;
    }
    if (!itemRid) {
      setError('Aucun livre rattaché — ouvre la review depuis la page du livre.');
      return;
    }
    if (!ctx) {
      setError('Module Library non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = isEditExisting
        ? (editingPayload?.date ?? new Date().toISOString())
        : new Date().toISOString();
      const payload = {
        itemRid: itemRid,
        date: dateIso,
        kind,
        title: null,
        content: trimmedContent,
        page: page ? Number(page) : null,
        spoiler: editingPayload?.spoiler ?? false,
      };
      if (isEditExisting && editing) {
        await libraryReviewsClient.update(ctx.moduleUserId, ctx.mainKey, editing.id, payload);
      } else {
        await libraryReviewsClient.create(ctx.moduleUserId, ctx.mainKey, payload);
      }
      bumpReviewsVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Erreur lors de l’enregistrement.',
      );
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="space-y-3 px-[22px] pt-3.5 pb-3">
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
                    'h-8 cursor-pointer rounded-sm border text-[12px] transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                    active
                      ? 'border-accent bg-accent font-semibold text-white'
                      : 'border-hair bg-bg text-muted hover:border-ink-soft hover:text-ink',
                  )}
                >
                  {LIBRARY_REVIEW_KIND_LABEL[k]}
                </button>
              );
            })}
          </div>
          <DirkInput
            inputMode="numeric"
            value={page}
            onChange={(e) => setPage(e.target.value.replace(/\D/g, '').slice(0, 5))}
            onKeyDown={(e) => submitOnCmdEnter(e, handleSave)}
            placeholder="Page"
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
        />
      </div>
      <Footer
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        submitLabel={isEditExisting ? t('common.actions.update') : t('common.actions.save')}
        submittingLabel={isEditExisting ? 'Mise à jour…' : 'Enregistrement…'}
      />
    </>
  );
}
