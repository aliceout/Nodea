import { useMemo, useState } from 'react';
import { splitThreads } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import { Modal } from '@/ui/atoms/layout/Modal';

import {
  useJournalActions,
  useJournalData,
  type ThreadMutationResult,
} from '../context';
import ThreadRow from './ThreadRow';

interface ThreadsManagerModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Thread management surface for Journal (issue #57). Opened from
 * the Journal side column ; lists every thread and lets the user
 * rename or delete each one inline. Renaming into an existing
 * thread name is a de facto merge (the underlying mutation helper
 * dedups on collision) — that pattern replaces the original
 * multi-select merge bar after the audit pass.
 *
 * Each operation runs an optimistic local update + parallel PATCHes
 * via the context actions ; a status banner surfaces the result
 * (« 12 réussis, 0 échec »).
 *
 * Lives in-module rather than in Settings — the architectural
 * choice from the audit thread : data lives where users use it, so
 * does the management. Settings stays a thin identity / security
 * surface.
 */
export default function ThreadsManagerModal({
  open,
  onClose,
}: ThreadsManagerModalProps) {
  const { t } = useI18n();
  const { entries } = useJournalData();
  const { renameThread, deleteThread } = useJournalActions();

  // Alphabetised list of every thread that appears in at least one
  // entry. Recomputed only when entries change, which is rare (the
  // manager is opened on demand, not on every render of the page).
  const threadNames = useMemo<ReadonlyArray<string>>(() => {
    const set = new Set<string>();
    for (const entry of entries) {
      for (const name of splitThreads(entry.thread)) set.add(name);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'fr'));
  }, [entries]);

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
      const res = await renameThread(editingName, trimmed);
      setLastResult({ ...res, label: t('journal.threadsManager.opRename') });
    } finally {
      setWorking(false);
      cancelRename();
    }
  }

  async function handleDelete(name: string) {
    if (
      !window.confirm(
        t('journal.threadsManager.confirmDelete', { values: { name } }),
      )
    )
      return;
    setLastResult(null);
    setWorking(true);
    try {
      const res = await deleteThread(name);
      setLastResult({ ...res, label: t('journal.threadsManager.opDelete') });
    } finally {
      setWorking(false);
    }
  }

  return (
    <Modal open={open} onClose={working ? () => undefined : onClose}>
      <div className="flex max-h-[calc(100vh-160px)] flex-col">
        <header className="flex items-baseline justify-between gap-3 border-b border-hair px-5 py-4">
          <h2 className="text-[16px] font-semibold text-ink">
            {t('journal.threadsManager.title')}
          </h2>
          <p className="text-[12px] text-muted">
            {t('journal.threadsManager.subtitle', {
              values: { count: threadNames.length },
            })}
          </p>
        </header>

        {lastResult ? (
          <div
            role="status"
            className="border-b border-hair px-5 py-2.5 text-[12px] text-ink-soft"
          >
            {lastResult.label} ·{' '}
            {t('journal.threadsManager.opResult', {
              values: {
                ok: lastResult.updatedIds.length,
                failed: lastResult.failedIds.length,
              },
            })}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {threadNames.length === 0 ? (
            <p className="py-8 text-center text-[13px] italic text-muted">
              {t('journal.threadsManager.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-hair">
              {threadNames.map((name) => (
                <ThreadRow
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
                />
              ))}
            </ul>
          )}
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-hair px-5 py-3">
          <Button
            variant="neutral"
            size="sm"
            onClick={onClose}
            disabled={working}
          >
            {t('common.actions.close')}
          </Button>
        </footer>
      </div>
    </Modal>
  );
}
