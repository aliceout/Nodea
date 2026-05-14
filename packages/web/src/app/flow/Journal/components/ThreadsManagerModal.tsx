import { useMemo, useState } from 'react';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import { Modal } from '@/ui/atoms/layout/Modal';

import {
  useJournalActions,
  useJournalData,
  type ThreadMutationResult,
} from '../context';
import { computeThreadStats, type ThreadStats } from '../lib/thread-stats';
import ThreadRow from './ThreadRow';

interface ThreadsManagerModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Thread management surface for Journal (issue #57). Opened from
 * the Journal side column ; renders a list of every thread with
 * its stats and lets the user :
 *   - rename a thread inline (Enter / blur commit, Escape cancel),
 *   - delete a thread (drops it from every entry that carried it),
 *   - select 2+ threads and merge them into a single target name.
 *
 * Each operation runs an optimistic local update + parallel PATCHes
 * via the context actions ; a status banner surfaces the result
 * (« 12 réussis, 0 échec »).
 *
 * Lives in-module rather than in Settings — the architectural
 * choice from the audit thread : data lives where users use it, so
 * does the management. Settings stays a thin identity / security
 * surface.
 *
 * Split (CLAUDE.md « factor early ») : per-row rendering moved to
 * `ThreadRow` ; this file orchestrates the rename / merge / delete
 * lifecycles and the merge-target picker.
 */
export default function ThreadsManagerModal({
  open,
  onClose,
}: ThreadsManagerModalProps) {
  const { t } = useI18n();
  const { entries } = useJournalData();
  const { renameThread, mergeThreads, deleteThread } = useJournalActions();

  const stats = useMemo<ReadonlyArray<ThreadStats>>(
    () => computeThreadStats(entries),
    [entries],
  );

  const [editingName, setEditingName] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [mergeTarget, setMergeTarget] = useState<string>('');
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
      setSelected((prev) => {
        const next = new Set(prev);
        next.delete(name);
        return next;
      });
      setLastResult({ ...res, label: t('journal.threadsManager.opDelete') });
    } finally {
      setWorking(false);
    }
  }

  async function handleMerge() {
    if (selected.size < 2) return;
    const sources = Array.from(selected);
    const target = mergeTarget || sources[0]!;
    if (!sources.includes(target)) return;
    if (
      !window.confirm(
        t('journal.threadsManager.confirmMerge', {
          values: { count: sources.length, target },
        }),
      )
    )
      return;
    setLastResult(null);
    setWorking(true);
    try {
      const otherSources = sources.filter((s) => s !== target);
      const res = await mergeThreads(otherSources, target);
      setSelected(new Set());
      setMergeTarget('');
      setLastResult({ ...res, label: t('journal.threadsManager.opMerge') });
    } finally {
      setWorking(false);
    }
  }

  function toggleSelected(name: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      // Reset merge target if it's no longer selected.
      setMergeTarget((current) =>
        current && next.has(current) ? current : '',
      );
      return next;
    });
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
              values: { count: stats.length },
            })}
          </p>
        </header>

        {selected.size >= 2 ? (
          <div className="border-b border-hair bg-bg-2 px-5 py-3 text-[12.5px]">
            <p className="mb-2 text-ink">
              {t('journal.threadsManager.mergeIntro', {
                values: { count: selected.size },
              })}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-muted" htmlFor="thread-merge-target">
                {t('journal.threadsManager.mergeTargetLabel')}
              </label>
              <select
                id="thread-merge-target"
                value={mergeTarget}
                onChange={(e) => setMergeTarget(e.target.value)}
                disabled={working}
                className="rounded-md border border-hair bg-bg px-2 py-1 text-[13px] text-ink"
              >
                <option value="">
                  {t('journal.threadsManager.mergeTargetPlaceholder')}
                </option>
                {Array.from(selected).map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <Button
                variant="primary"
                size="sm"
                onClick={() => void handleMerge()}
                disabled={working || mergeTarget === ''}
              >
                {t('journal.threadsManager.mergeCta')}
              </Button>
            </div>
          </div>
        ) : null}

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
          {stats.length === 0 ? (
            <p className="py-8 text-center text-[13px] italic text-muted">
              {t('journal.threadsManager.empty')}
            </p>
          ) : (
            <ul className="divide-y divide-hair">
              {stats.map((row) => (
                <ThreadRow
                  key={row.name}
                  row={row}
                  isEditing={editingName === row.name}
                  isSelected={selected.has(row.name)}
                  working={working}
                  draftName={draftName}
                  setDraftName={setDraftName}
                  onSelectToggle={() => toggleSelected(row.name)}
                  onStartRename={() => startRename(row.name)}
                  onCommitRename={() => void commitRename()}
                  onCancelRename={cancelRename}
                  onDelete={() => void handleDelete(row.name)}
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
