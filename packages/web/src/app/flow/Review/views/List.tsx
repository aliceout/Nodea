import { useEffect, useMemo, useState } from 'react';
import { ArrowUturnLeftIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { formatLongDate } from '@/core/i18n/date-format';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/module/EmptyHint';
import GroupBlock from '@/ui/dirk/module/GroupBlock';
import HoverActions from '@/ui/dirk/module/HoverActions';
import ModuleShell from '@/ui/dirk/module/ModuleShell';
import PageHeading from '@/ui/dirk/module/PageHeading';
import Topbar from '@/ui/dirk/Topbar';
import { QUESTION_STEPS } from '../config/steps';
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

/** « 12 mars 14:30 » — used for the « Brouillons » timestamp.
 *  Specific to this surface (no other module surfaces a date with
 *  hour / minute on the same line), so it stays local instead of
 *  going to `core/i18n/date-fr.ts`. */
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
  const { t, tn } = useI18n();
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { loading, error, entries, deleteReview } = useReview();
  const currentYear = new Date().getFullYear();
  const [draftYear, setDraftYear] = useState<number>(currentYear);
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

  // A « bilan annuel » is unique per year. If the chosen year already
  // has a finalized entry, « Commencer » would silently create a
  // second one (audit 2026-06 passe 2, 3.7). Detect it and steer the
  // user to EDIT the existing review instead.
  const existingForYear = useMemo(
    () => entries.find((e) => e.payload.year === draftYear) ?? null,
    [entries, draftYear],
  );

  async function handleDelete(record: ReviewRecord): Promise<void> {
    if (
      !window.confirm(
        t('review.list.confirmDelete', { values: { year: record.payload.year } }),
      )
    )
      return;
    await deleteReview(record.id);
  }

  function handleDeleteDraft(year: number): void {
    if (!window.confirm(t('review.list.confirmDeleteDraft', { values: { year } })))
      return;
    clearReviewDraft(year);
    setDrafts(listReviewDrafts());
  }

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={tn('review.topbar.label', entries.length)}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      }
    >
      <PageHeading>{t('review.list.heading')}</PageHeading>

      <div className="mb-9 max-w-2xl space-y-3 text-[14px] leading-[1.55] text-ink-soft">
        <p>{t('review.list.intro1')}</p>
        <p>{t('review.list.intro2')}</p>
      </div>

      {error ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {error}
        </p>
      ) : null}

      <section className="mb-9">
        <h2 className="mb-2 border-b border-hair pb-1.5 text-[15px] font-semibold tracking-[-0.005em] text-ink">
          {t('review.list.newHeading')}
        </h2>
        <p className="mb-4 text-[13px] leading-[1.55] text-ink-soft">
          {t('review.list.newSubtitle', { values: { count: QUESTION_STEPS.length } })}
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              {t('review.list.yearLabel')}
            </span>
            <Input
              type="number"
              min={1900}
              max={2200}
              value={draftYear}
              align="center"
              onChange={(e) =>
                setDraftYear(Number(e.target.value) || currentYear)
              }
              className="w-28"
            />
          </label>
          {existingForYear ? (
            <Button
              variant="secondary"
              size="md"
              onClick={() => onEdit(existingForYear)}
            >
              {t('review.list.editExistingCta', { values: { year: draftYear } })}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="md"
              onClick={() => onStartNew(draftYear)}
            >
              {t('review.list.startCta')}
            </Button>
          )}
        </div>
        {existingForYear ? (
          <p
            role="status"
            className="mt-3 text-[12px] leading-[1.5] text-muted"
          >
            {t('review.list.yearTakenHint', { values: { year: draftYear } })}
          </p>
        ) : null}
      </section>

      {activeDrafts.length > 0 ? (
        <GroupBlock
          label={t('review.list.draftsHeading')}
          count={activeDrafts.length}
          countNoun={t('review.list.draftsCountNoun')}
          variant="eyebrow"
        >
          {activeDrafts.map((d) => (
            <DraftRow
              key={d.year}
              draft={d}
              onResume={() => onResume(d.year)}
              onDelete={() => handleDeleteDraft(d.year)}
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
          count={sorted.length}
          countNoun={t('review.list.pastCountNoun')}
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
