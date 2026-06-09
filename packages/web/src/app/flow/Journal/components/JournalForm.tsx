import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { JournalAttachment } from '@nodea/shared';

import { journalClient } from '@/core/api/modules/journal';
import { bytesToBase64Url, randomBytes } from '@/core/crypto/base64';
import { attachmentSrc, resizeImageFile } from '@/app/flow/Journal/hooks/imageResize';
import { useJournalDraft } from '@/app/flow/Journal/hooks/useJournalDraft';
import { pickJournalPrompt } from '@/app/flow/Journal/prompts';
import { useModuleClient } from '@/core/modules/use-module-client';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';

import MarkdownEditor from '@/ui/dirk/forms/MarkdownEditor';
import ThreadSuggestInput from '@/ui/dirk/forms/ThreadSuggestInput';

import { useJournalFilters } from '../context';
import type { JournalEntry } from '../lib/types';

interface JournalFormProps {
  /** When set, the form edits this entry instead of creating one. */
  initial?: JournalEntry;
  /** Close the form (cancel, or after a successful submit). */
  onClose: () => void;
}

/**
 * Journal entry form — inline composer rendered by `PrimaryColumn`
 * above the entries list, mirroring the HRT / Mood / Goals posture :
 * a bordered card with the form fields + a cancel/save row, no
 * modal.
 *
 * Reuses the shared atoms (`MarkdownEditor`, `ThreadSuggestInput`)
 * from `@/ui/dirk/forms/`.
 *
 * Edit vs create :
 *   - On edit, the entry's date is preserved and `initial`
 *     pre-fills every field. The draft auto-restore is skipped.
 *   - On create, `new Date().toISOString()` is the entry date
 *     and the draft slot (`useJournalDraft`) auto-saves +
 *     auto-restores the form state across reloads.
 *
 * `bumpJournalVersion` triggers the data refetch on success ;
 * `onClose` returns the user to the list ; the in-component error
 * feedback surfaces validation + network failures with friendly
 * messages.
 */
export default function JournalForm({ initial, onClose }: JournalFormProps) {
  const { t, tn, language } = useI18n();
  const ctx = useModuleClient('journal');
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);
  // Thread suggestions come from the provider's already-computed,
  // memoised list — this form is rendered inside `JournalProvider`.
  // It used to re-fetch + re-decrypt the WHOLE collection
  // (attachments included) on every form mount just to rebuild
  // this exact list (audit 2026-06).
  const { threads: threadOptions } = useJournalFilters();

  // Drafts live for « new entry » flows only — when editing an
  // existing record the canonical state is the server payload.
  const {
    hydrated: draftHydrated,
    hydrating: draftHydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useJournalDraft();

  const [thread, setThread] = useState(initial?.thread ?? '');
  const [content, setContent] = useState(initial?.content ?? '');
  const [attachments, setAttachments] = useState<JournalAttachment[]>(
    initial?.attachments ?? [],
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');

  const isEdit = initial !== undefined;

  // Pick the day's prompt once per mount — using `useMemo` (not
  // a fresh call per render) keeps the placeholder stable while
  // the user types. Edit flows reuse the default since the
  // content area is never empty there anyway.
  const prompt = useMemo(
    () => (isEdit ? undefined : pickJournalPrompt(language)),
    [isEdit, language],
  );

  // Auto-load any draft sitting in localStorage as soon as it
  // surfaces from `useJournalDraft`. Skipped when editing or
  // when the user has already typed something. The « brouillon
  // repris » banner stays visible until the user submits or
  // wipes it.
  useEffect(() => {
    if (isEdit || draftHydrating || draftRestored) return;
    if (!draftHydrated) return;
    if (
      thread.trim() !== '' ||
      content.trim() !== '' ||
      attachments.length > 0
    ) {
      return;
    }
    setThread(draftHydrated.thread);
    setContent(draftHydrated.content);
    setAttachments(draftHydrated.attachments ?? []);
    setDraftRestored(true);
  }, [
    isEdit,
    draftHydrating,
    draftHydrated,
    draftRestored,
    thread,
    content,
    attachments,
  ]);

  // Persist every keystroke (debounced inside `saveDraft`).
  // Skip the edit path — that flow's source-of-truth is the
  // server record.
  useEffect(() => {
    if (isEdit) return;
    saveDraft({ thread, content, attachments });
  }, [thread, content, attachments, isEdit, saveDraft]);

  function randomAttachmentId(): string {
    // Central randomness only (CLAUDE.md crypto rule 3) — the id is
    // not secret (it lives inside the encrypted payload) but the
    // codebase has exactly one source of random bytes on purpose.
    return `att-${bytesToBase64Url(randomBytes(9))}`;
  }

  async function handleAttach(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (attachments.length >= 3) {
      setError(t('journal.composer.errors.maxAttachments'));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t('journal.composer.errors.attachmentTooLarge'));
      return;
    }
    setError(null);
    try {
      const resized = await resizeImageFile(file);
      const id = randomAttachmentId();
      setAttachments((prev) => [
        ...prev,
        { id, mime: resized.mime, data: resized.data },
      ]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('journal.composer.errors.attachmentReadFailed'),
      );
    }
  }

  function handleRemoveAttachment(id: string): void {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedThread = thread.trim();
    const trimmedContent = content.trim();
    if (!trimmedThread) {
      setError(t('journal.composer.errors.threadRequired'));
      return;
    }
    if (!trimmedContent) {
      setError(t('journal.composer.errors.contentRequired'));
      return;
    }
    if (!ctx) {
      setError(t('journal.composer.errors.missingConfig'));
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = initial ? initial.dateIso : new Date().toISOString();
      const payload = {
        type: 'journal.entry' as const,
        date: dateIso,
        thread: trimmedThread,
        title: null,
        content: trimmedContent,
        attachments,
      };
      if (initial) {
        await journalClient.update(ctx.moduleUserId, ctx.mainKey, initial.id, payload);
      } else {
        await journalClient.create(ctx.moduleUserId, ctx.mainKey, payload);
        clearDraft();
      }
      bumpJournalVersion();
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t('journal.composer.errors.saveFailed'),
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
      <div className="space-y-3">
        {draftRestored ? (
          <div className="flex items-baseline justify-between gap-2 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-1.5 text-[12px] text-accent-deep">
            <span>{t('journal.composer.draftRestored')}</span>
            <button
              type="button"
              onClick={() => {
                setThread('');
                setContent('');
                // Without this, the restored images stayed visible
                // AND the 800 ms auto-save flush re-wrote the slot
                // `clearDraft()` just removed (audit 2026-06).
                setAttachments([]);
                setDraftRestored(false);
                clearDraft();
              }}
              className="cursor-pointer text-[11px] underline-offset-2 hover:underline"
            >
              {t('journal.composer.resetDraft')}
            </button>
          </div>
        ) : null}

        <ThreadSuggestInput
          value={thread}
          onChange={setThread}
          options={threadOptions}
          disabled={submitting}
          onSubmit={handleSave}
          {...(error ? { ariaDescribedBy: 'journal-form-error' } : {})}
        />

        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSubmit={handleSave}
          disabled={submitting}
          mode={editorMode}
          onModeChange={setEditorMode}
          {...(prompt ? { placeholder: prompt } : {})}
          {...(error ? { ariaDescribedBy: 'journal-form-error' } : {})}
        />

        <div className="flex flex-wrap items-center gap-2">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="group/att relative h-16 w-16 shrink-0 overflow-hidden rounded-sm border border-hair bg-bg-2"
            >
              <img
                src={attachmentSrc(att)}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                aria-label={t('journal.composer.removeImageAria')}
                title={t('journal.composer.removeImageTitle')}
                className="absolute right-0.5 top-0.5 cursor-pointer rounded-sm bg-bg/85 p-0.5 text-ink-soft opacity-0 transition-opacity hover:text-danger group-hover/att:opacity-100 group-focus-within/att:opacity-100"
              >
                <XMarkIcon className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>
          ))}
          {attachments.length < 3 ? (
            <>
              <input
                ref={attachInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleAttach}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => attachInputRef.current?.click()}
                disabled={submitting}
                className={cn(
                  'flex h-16 w-16 shrink-0 cursor-pointer items-center justify-center rounded-sm border border-dashed border-hair bg-bg text-[11px] text-muted',
                  'transition-colors hover:border-accent hover:text-accent',
                  'disabled:cursor-not-allowed disabled:opacity-50',
                )}
                aria-label={t('journal.composer.attachImageAria')}
                title={t('journal.composer.attachImageAria')}
              >
                {t('journal.composer.attachImageCta')}
              </button>
            </>
          ) : null}
          {attachments.length > 0 ? (
            <p className="text-[11px] italic text-muted">
              {tn('journal.composer.attachmentCount', attachments.length)}
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <p id="journal-form-error" role="alert" className="mt-3 text-[12px] text-danger">
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
          {t('common.actions.cancel', { defaultValue: 'Annuler' })}
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          disabled={submitting}
        >
          {submitting
            ? isEdit
              ? t('journal.composer.submittingUpdate')
              : t('common.states.saving')
            : isEdit
              ? t('common.actions.update')
              : t('common.actions.save')}
        </Button>
      </div>
    </form>
  );
}
