import { useState } from 'react';

import type { ThreadMutationResult } from '@/lib/threads-mutate';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import Button from '@/ui/atoms/dirk/Button';
import { Modal } from '@/ui/atoms/layout/Modal';
import ThreadManagerRow from '@/ui/dirk/module/ThreadManagerRow';

/**
 * Generic thread / theme management modal (issue #57, generalised for
 * #155-era reuse). Lists every name and lets the user rename or delete
 * each one inline. Renaming into an existing name is a de facto merge
 * (the caller's mutation helper dedups on collision). Each op runs an
 * optimistic update + parallel PATCHes via the injected handlers ; a
 * status banner surfaces the « N réussis, M échoués » result.
 *
 * Module-agnostic: the caller passes the deduped `names`, the
 * rename/delete handlers (which own the optimistic update + rollback),
 * and an `i18nPrefix` (e.g. `journal.threadsManager` /
 * `goals.themesManager`) whose sub-keys — `title`, `subtitle`, `empty`,
 * `confirmDelete`, `opRename`, `opDelete`, `opResult`, `renameAria`,
 * `deleteAria` — are identical across modules. Lives in `ui/dirk/module`
 * so Journal (« fils ») and Goals (« thèmes ») share one component.
 */
interface ThreadManagerModalProps {
  open: boolean;
  onClose: () => void;
  /** Deduped, sorted list of names to manage. */
  names: ReadonlyArray<string>;
  onRename: (from: string, to: string) => Promise<ThreadMutationResult>;
  onDelete: (name: string) => Promise<ThreadMutationResult>;
  /** i18n key namespace, e.g. `journal.threadsManager`. */
  i18nPrefix: string;
}

export default function ThreadManagerModal({
  open,
  onClose,
  names,
  onRename,
  onDelete,
  i18nPrefix,
}: ThreadManagerModalProps) {
  const { t } = useI18n();
  const confirm = useConfirm();

  const [editingName, setEditingName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [working, setWorking] = useState(false);
  const [lastResult, setLastResult] = useState<
    (ThreadMutationResult & { label: string }) | null
  >(null);

  function startRename(name: string) {
    setEditingName(name);
    setDraftName(name);
    setLastResult(null);
  }

  function cancelRename() {
    setEditingName(null);
    setDraftName('');
  }

  async function commitRename() {
    if (editingName === null) return;
    const trimmed = draftName.trim();
    if (trimmed.length === 0 || trimmed === editingName) {
      cancelRename();
      return;
    }
    setWorking(true);
    try {
      const res = await onRename(editingName, trimmed);
      setLastResult({ ...res, label: t(`${i18nPrefix}.opRename`) });
    } finally {
      setWorking(false);
      cancelRename();
    }
  }

  async function handleDelete(name: string) {
    const ok = await confirm({
      message: t(`${i18nPrefix}.confirmDelete`, { values: { name } }),
      tone: 'danger',
    });
    if (!ok) return;
    setLastResult(null);
    setWorking(true);
    try {
      const res = await onDelete(name);
      setLastResult({ ...res, label: t(`${i18nPrefix}.opDelete`) });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open={open} onClose={working ? () => undefined : onClose}>
      <div className="flex max-h-[calc(100vh-160px)] flex-col">
        <header className="flex items-baseline justify-between gap-3 border-b border-hair px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink">
            {t(`${i18nPrefix}.title`)}
          </h2>
          <p className="text-[12px] text-muted">
            {t(`${i18nPrefix}.subtitle`, { values: { count: names.length } })}
          </p>
        </header>

        {lastResult ? (
          <div
            role="status"
            className="border-b border-hair px-5 py-2.5 text-[12px] text-ink-soft"
          >
            {lastResult.label} ·{' '}
            {t(`${i18nPrefix}.opResult`, {
              values: {
                ok: lastResult.updatedIds.length,
                failed: lastResult.failedIds.length,
              },
            })}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {names.length === 0 ? (
            <p className="py-8 text-center text-[13px] italic text-muted">
              {t(`${i18nPrefix}.empty`)}
            </p>
          ) : (
            <ul className="divide-y divide-hair">
              {names.map((name) => (
                <ThreadManagerRow
                  key={name}
                  name={name}
                  isEditing={editingName === name}
                  working={working}
                  draftName={draftName}
                  setDraftName={setDraftName}
                  onStartRename={() => startRename(name)}
                  onCommitRename={() => void commitRename()}
                  onCancelRename={cancelRename}
                  onDelete={() => void handleDelete(name)}
                  renameAria={t(`${i18nPrefix}.renameAria`, { values: { name } })}
                  deleteAria={t(`${i18nPrefix}.deleteAria`, { values: { name } })}
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hair px-5 py-3">
          <Button variant="neutral" size="sm" onClick={onClose} disabled={working}>
            {t('common.actions.close')}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
