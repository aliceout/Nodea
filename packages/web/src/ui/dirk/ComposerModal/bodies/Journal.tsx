import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { PassageAttachment } from '@nodea/shared';

import { passageClient } from '@/core/api/modules/passage';
import {
  attachmentSrc,
  resizeImageFile,
} from '@/app/flow/Journal/hooks/imageResize';
import { useJournalDraft } from '@/app/flow/Journal/hooks/useJournalDraft';
import { pickJournalPrompt } from '@/app/flow/Journal/prompts';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

import Footer from '../components/Footer';
import MarkdownEditor from '../components/MarkdownEditor';
import ThreadSuggestInput from '../components/ThreadSuggestInput';

interface JournalBodyProps {
  onClose: () => void;
}

/**
 * Journal entry form — uses the legacy passage shape under
 * the new « Journal » module : thread (required, single-valued
 * — no comma multi anymore), content (required, the heart of
 * the entry, with lightweight Markdown formatting), up to 3
 * inline image attachments.
 *
 * Title was dropped : now that thread is mandatory, every
 * entry is already filed under a fil. A title on top of that
 * became redundant noise — the K Journal page surfaces date +
 * content directly inside the thread group.
 *
 * Backed by `passageClient` since the `passage_entries` table
 * is the journal-shaped one — the K Passages module (book
 * quotes) gets its own future schema.
 *
 * Branches between **create** and **update** based on
 * `composer.editing` : the Journal page's pencil icon prefills
 * via `openComposer('journal', { type, id, payload })`. Both
 * branches `bumpJournalVersion()` so the page refetches without
 * a reload.
 *
 * Date is preserved on edit (the user is amending content, not
 * redating) ; fresh entries land on `new Date().toISOString()`.
 *
 * Drafts are auto-saved (debounced) for new-entry flows, and
 * auto-restored on next open as long as the form is empty so
 * an in-flight typing session is never clobbered.
 */
export default function JournalBody({ onClose }: JournalBodyProps) {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['journal']?.moduleUserId ?? null;
  const bumpJournalVersion = useNodeaStore((s) => s.bumpJournalVersion);
  const editing = useNodeaStore((s) =>
    s.composer.editing && s.composer.editing.type === 'journal'
      ? s.composer.editing
      : null,
  );
  // Drafts live for « new entry » flows only — when editing
  // an existing record the canonical state is the server
  // payload.
  const {
    hydrated: draftHydrated,
    hydrating: draftHydrating,
    save: saveDraft,
    clear: clearDraft,
  } = useJournalDraft();

  const [thread, setThread] = useState(editing?.payload.thread ?? '');
  const [content, setContent] = useState(editing?.payload.content ?? '');
  const [attachments, setAttachments] = useState<PassageAttachment[]>(
    editing?.payload.attachments ?? [],
  );
  const [threadOptions, setThreadOptions] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draftRestored, setDraftRestored] = useState(false);
  const attachInputRef = useRef<HTMLInputElement | null>(null);
  // Visual mode is the Word-like contentEditable surface
  // (default for non-technical users) ; Markdown mode shows
  // the raw source for anyone who'd rather type `**foo**`
  // directly. Storage stays Markdown either way —
  // `MarkdownEditor` handles the round trip.
  const [editorMode, setEditorMode] = useState<'visual' | 'markdown'>('visual');

  const isEdit = editing !== null;

  // Pick the day's prompt once per Composer mount — using
  // `useMemo` (not a fresh call per render) keeps the
  // placeholder stable while the user types. Edit flows reuse
  // the canonical default since the surface is never empty
  // there anyway.
  const prompt = useMemo(
    () => (isEdit ? undefined : pickJournalPrompt()),
    [isEdit],
  );

  // Auto-load any draft sitting in localStorage as soon as it
  // surfaces from `useJournalDraft`. Skipped when editing or
  // when the user has already typed something (we don't want
  // to clobber active input). The « brouillon repris » banner
  // stays visible until the user submits or wipes it.
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
  // server record, no draft slot involved.
  useEffect(() => {
    if (isEdit) return;
    saveDraft({ thread, content, attachments });
  }, [thread, content, attachments, isEdit, saveDraft]);

  function randomAttachmentId(): string {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
      return crypto.randomUUID();
    }
    return `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  async function handleAttach(e: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (attachments.length >= 3) {
      setError('Trois images maximum par entrée.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('Image trop volumineuse (10 Mo maximum avant compression).');
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
      setError(err instanceof Error ? err.message : "Impossible de lire l'image.");
    }
  }

  function handleRemoveAttachment(id: string): void {
    setAttachments((prev) => prev.filter((a) => a.id !== id));
  }

  // Pull existing threads once on mount so the input can offer
  // them as suggestions. Existing entries that pre-date the
  // single-thread switch may still hold a comma-separated
  // value ; we split them out so each fil shows up
  // individually in the dropdown. Failures are swallowed —
  // the dropdown simply stays empty rather than showing an
  // error inside the form.
  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    passageClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const set = new Set<string>();
        for (const r of records) {
          const raw = r.payload.thread ?? '';
          for (const t of raw.split(',')) {
            const trimmed = t.trim();
            if (trimmed) set.add(trimmed);
          }
        }
        setThreadOptions(
          Array.from(set).sort((a, b) => a.localeCompare(b, 'fr')),
        );
      })
      .catch(() => {
        if (cancelled) return;
        setThreadOptions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId]);

  async function handleSave(): Promise<void> {
    if (submitting) return;
    setError(null);
    const trimmedThread = thread.trim();
    const trimmedContent = content.trim();
    if (!trimmedThread) {
      setError('Le fil est requis — choisis-en un existant ou crée-en un nouveau.');
      return;
    }
    if (!trimmedContent) {
      setError('Le contenu est requis.');
      return;
    }
    if (!mainKey || !moduleUserId) {
      setError('Module Journal non configuré ou clé absente — reconnecte-toi.');
      return;
    }
    setSubmitting(true);
    try {
      const dateIso = editing ? editing.payload.date : new Date().toISOString();
      const payload = {
        type: 'passage.entry' as const,
        date: dateIso,
        thread: trimmedThread,
        title: null,
        content: trimmedContent,
        attachments,
      };
      if (editing) {
        await passageClient.update(moduleUserId, mainKey, editing.id, payload);
      } else {
        await passageClient.create(moduleUserId, mainKey, payload);
        // Successful save → wipe the draft slot so the next
        // open starts fresh instead of resurrecting what the
        // user just submitted.
        clearDraft();
      }
      bumpJournalVersion();
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
        {draftRestored ? (
          <div className="flex items-baseline justify-between gap-2 rounded-sm border-l-2 border-accent bg-accent-soft/40 px-3 py-1.5 text-[12px] text-accent-deep">
            <span>Brouillon en cours repris.</span>
            <button
              type="button"
              onClick={() => {
                setThread('');
                setContent('');
                setDraftRestored(false);
                clearDraft();
              }}
              className="cursor-pointer text-[11px] underline-offset-2 hover:underline"
            >
              Repartir à zéro
            </button>
          </div>
        ) : null}

        <ThreadSuggestInput
          value={thread}
          onChange={setThread}
          options={threadOptions}
          disabled={submitting}
          onSubmit={handleSave}
        />

        <MarkdownEditor
          value={content}
          onChange={setContent}
          onSubmit={handleSave}
          disabled={submitting}
          mode={editorMode}
          onModeChange={setEditorMode}
          {...(prompt ? { placeholder: prompt } : {})}
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
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={() => handleRemoveAttachment(att.id)}
                aria-label="Retirer l'image"
                title="Retirer"
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
                aria-label="Joindre une image"
                title="Joindre une image"
              >
                + Image
              </button>
            </>
          ) : null}
          {attachments.length > 0 ? (
            <p className="text-[11px] italic text-muted">
              {attachments.length} / 3 image
              {attachments.length === 1 ? '' : 's'} — chiffrée
              {attachments.length === 1 ? '' : 's'} avec l’entrée.
            </p>
          ) : null}
        </div>
      </div>
      <Footer
        onSubmit={handleSave}
        submitting={submitting}
        error={error}
        submitLabel={isEdit ? 'Mettre à jour' : 'Enregistrer'}
        submittingLabel={isEdit ? 'Mise à jour…' : 'Enregistrement…'}
      />
    </>
  );
}
