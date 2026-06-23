import { useEffect, useMemo, useState } from 'react';
import { ArrowUturnLeftIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatLongDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { useConfirm } from '@/ui/dirk/confirm/confirm-context';
import InlineAlert from '@/ui/atoms/feedback/InlineAlert';
import Button from '@/ui/atoms/dirk/Button';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import HoverActions from '@/ui/dirk/module/HoverActions';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import PageHeading from '@/ui/dirk/module/PageHeading';
import Topbar from '@/ui/dirk/Topbar';
import {
  clearReviewDraft,
  listReviewDrafts,
  type DraftSummary,
} from '../hooks/useDraft';
import { useReview, type ReviewRecord } from '../hooks/useReview';

interface ListProps {
  onStartNew(year: number): void;
  onResume(year: number): void;
  onOpen(record: ReviewRecord): void;
  onEdit(record: ReviewRecord): void;
}

const DRAFT_DATETIME_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
});

export default function ReviewListView({
  onStartNew,
  onResume,
  onOpen,
  onEdit,
}: ListProps) {
  const { t } = useI18n();
  const confirm = useConfirm();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { loading, error, entries, deleteReview } = useReview();
  const currentYear = new Date().getFullYear();
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  // Load draft summaries from localStorage on mount and whenever
  // the entries list changes (a finalized save clears its draft,
  // so the in-progress section should refresh).
  //
  // A draft whose year already has a finalized entry is stale leftover
  // (submitted on another device, or finalized after the draft was
  // started). It used to be merely hidden from the list — but it
  // lingered in localStorage with no way to remove it from the UI
  // (audit 2026-06 passe 2, 3.7). Prune those here so they can't pile
  // up invisibly.
  useEffect(() => {
    const all = listReviewDrafts();
    const finalized = new Set(entries.map((e) => e.payload.year));
    const stale = all.filter((d) => finalized.has(d.year));
    for (const d of stale) clearReviewDraft(d.year);
    setDrafts(all.filter((d) => !finalized.has(d.year)));
  }, [entries]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.payload.year - a.payload.year),
    [entries],
  );

  // Drafts are already pruned of finalized years in the effect above ;
  // this stays as a render-time safety net while a prune is in flight.
  const finalizedYears = useMemo(
    () => new Set(entries.map((e) => e.payload.year)),
    [entries],
  );
  const activeDrafts = useMemo(
    () => drafts.filter((d) => !finalizedYears.has(d.year)),
    [drafts, finalizedYears],
  );

  async function handleDelete(record: ReviewRecord): Promise<void> {
    const ok = await confirm({
      message: t('review.list.confirmDelete', { values: { year: record.payload.year } }),
      tone: 'danger',
    });
    if (!ok) return;
    await deleteReview(record.id);
  }

  async function handleDeleteDraft(year: number): Promise<void> {
    const ok = await confirm({
      message: t('review.list.confirmDeleteDraft', { values: { year } }),
      tone: 'danger',
    });
    if (!ok) return;
    clearReviewDraft(year);
    setDrafts(listReviewDrafts());
  }

  // Topbar « + Nouveau bilan » — quick-start the CURRENT year. Mirrors
  // the in-page section's guard so it never creates a duplicate: edit an
  // existing finalized review, resume an in-progress draft, else start
  // fresh. The page section stays for picking a different year.
  function startCurrentYear(): void {
    const finalized = entries.find((e) => e.payload.year === currentYear);
    if (finalized) {
      onEdit(finalized);
      return;
    }
    if (activeDrafts.some((d) => d.year === currentYear)) {
      onResume(currentYear);
      return;
    }
    onStartNew(currentYear);
  }

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={t('review.title')}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button
            variant="primary"
            size="sm"
            onClick={startCurrentYear}
            className="hidden lg:inline-flex"
          >
            {t('review.topbar.newCta')}
          </Button>
        </Topbar>
      }
    >
      <PageHeading>{t('review.list.heading')}</PageHeading>

      <div className="mb-9 max-w-2xl space-y-3 text-[14px] leading-[1.55] text-ink-soft">
        <p>{t('review.list.intro1')}</p>
        <p>{t('review.list.intro2')}</p>
      </div>

      {error ? <InlineAlert className="mb-4">{error}</InlineAlert> : null}

      {activeDrafts.length > 0 ? (
        <GroupBlock
          label={t('review.list.draftsHeading')}
          variant="eyebrow"
        >
          {activeDrafts.map((d) => (
            <DraftRow
              key={d.year}
              draft={d}
              onResume={() => onResume(d.year)}
              onDelete={() => void handleDeleteDraft(d.year)}
            />
          ))}
        </GroupBlock>
      ) : null}

      {loading && sorted.length === 0 ? (
        <EmptyHint>{t('review.list.loading')}</EmptyHint>
      ) : sorted.length === 0 && activeDrafts.length === 0 ? (
        <EmptyHint>{t('review.list.empty')}</EmptyHint>
      ) : sorted.length === 0 ? null : (
        <GroupBlock
          label={t('review.list.pastHeading')}
        >
          {sorted.map((entry) => (
            <ReviewRow
              key={entry.id}
              record={entry}
              onOpen={() => onOpen(entry)}
              onEdit={() => onEdit(entry)}
              onDelete={() => void handleDelete(entry)}
            />
          ))}
        </GroupBlock>
      )}
    </ModuleShell>
  );
}

interface ReviewRowProps {
  record: ReviewRecord;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

function ReviewRow({ record, onOpen, onEdit, onDelete }: ReviewRowProps) {
  const { t, language } = useI18n();
  // `payload.updatedAt` is the in-payload write timestamp — the
  // entry-table wrapper no longer carries `updatedAt` (minimum-
  // readable-surface design). Always set by the create/update hooks.
  const updated = formatLongDate(record.payload.updatedAt, language);
  return (
    <li className="group flex items-center gap-3 border-b border-hair py-3 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-accent"
      >
        <p className="text-[14px] font-medium text-ink group-hover:text-accent">
          {t('review.list.rowYear', { values: { year: record.payload.year } })}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {t('review.list.rowUpdated', { values: { date: updated } })}
        </p>
      </button>

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label={t('review.list.rowEditAria')}
          title={t('common.actions.edit')}
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label={t('review.list.rowDeleteAria')}
          title={t('common.actions.delete')}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </li>
  );
}

interface DraftRowProps {
  draft: DraftSummary;
  onResume: () => void;
  onDelete: () => void;
}

function DraftRow({ draft, onResume, onDelete }: DraftRowProps) {
  const { t } = useI18n();
  const savedLabel =
    draft.savedAt != null
      ? t('review.list.draftSavedAt', {
          values: { date: DRAFT_DATETIME_FMT.format(new Date(draft.savedAt)) },
        })
      : t('review.list.draftSavingNow');
  return (
    <li className="group flex items-center gap-3 border-b border-hair py-3 last:border-b-0">
      <button
        type="button"
        onClick={onResume}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-accent"
      >
        <p className="flex items-baseline gap-2 text-[14px] font-medium text-ink group-hover:text-accent">
          {t('review.list.rowYear', { values: { year: draft.year } })}
          <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-deep">
            {t('review.list.draftBadge')}
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-muted">{savedLabel}</p>
      </button>

      <Button
        variant="secondary"
        size="sm"
        onClick={onResume}
        className="shrink-0"
      >
        <ArrowUturnLeftIcon className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
        {t('review.list.draftResume')}
      </Button>
      <HoverActions>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label={t('review.list.draftDeleteAria')}
          title={t('review.list.draftDeleteTitle')}
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </li>
  );
}
