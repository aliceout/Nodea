import { useEffect, useMemo, useState } from 'react';
import { ArrowUturnLeftIcon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useNodeaStore } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/EmptyHint';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
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

const ENTRY_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});
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
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { loading, error, entries, deleteReview } = useReview();
  const currentYear = new Date().getFullYear();
  const [draftYear, setDraftYear] = useState<number>(currentYear);
  const [drafts, setDrafts] = useState<DraftSummary[]>([]);

  // Load draft summaries from localStorage on mount and whenever
  // the entries list changes (a finalized save clears its draft,
  // so the in-progress section should refresh).
  useEffect(() => {
    setDrafts(listReviewDrafts());
  }, [entries]);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.payload.year - a.payload.year),
    [entries],
  );

  // A year that has a finalized entry shouldn't appear in the
  // « Brouillons » list — the draft was either already submitted
  // (and cleared) or is stale leftover from a different device.
  const finalizedYears = useMemo(
    () => new Set(entries.map((e) => e.payload.year)),
    [entries],
  );
  const activeDrafts = useMemo(
    () => drafts.filter((d) => !finalizedYears.has(d.year)),
    [drafts, finalizedYears],
  );

  async function handleDelete(record: ReviewRecord): Promise<void> {
    if (!window.confirm(`Supprimer le bilan ${record.payload.year} ?`)) return;
    await deleteReview(record.id);
  }

  function handleDeleteDraft(year: number): void {
    if (!window.confirm(`Supprimer le brouillon du bilan ${year} ?`)) return;
    clearReviewDraft(year);
    setDrafts(listReviewDrafts());
  }

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Review · ${entries.length} ${entries.length === 1 ? 'bilan' : 'bilans'}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        />
      }
    >
      <PageHeading>Bilans</PageHeading>

      <div className="mb-9 max-w-2xl space-y-3 text-[14px] leading-[1.55] text-ink-soft">
        <p>
          Le YearCompass est un carnet annuel pour relire l'année qui se
          termine et préparer celle qui arrive.
        </p>
        <p>
          Deux moitiés : on célèbre et on apprend du passé, puis on rêve
          et on planifie le futur.
        </p>
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
          Commencer un nouveau bilan
        </h2>
        <p className="mb-4 text-[13px] leading-[1.55] text-ink-soft">
          Un parcours guidé en {QUESTION_STEPS.length} étapes.
        </p>
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[12px] font-medium text-muted">
              Année concernée
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
          <Button
            variant="primary"
            size="md"
            onClick={() => onStartNew(draftYear)}
          >
            Démarrer
          </Button>
        </div>
      </section>

      {activeDrafts.length > 0 ? (
        <GroupBlock
          label="Brouillons en cours"
          count={activeDrafts.length}
          countNoun="brouillon"
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
        <EmptyHint>Chargement des bilans…</EmptyHint>
      ) : sorted.length === 0 && activeDrafts.length === 0 ? (
        <EmptyHint>Aucun bilan enregistré pour le moment.</EmptyHint>
      ) : sorted.length === 0 ? null : (
        <GroupBlock
          label="Bilans passés"
          count={sorted.length}
          countNoun="bilan"
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
  // `payload.updated_at` is the in-payload write timestamp — the
  // entry-table wrapper no longer carries `updated_at` (minimum-
  // readable-surface design). Empty string falls back to "—" via
  // `Date(NaN)` → "Date invalide" which is acceptable for legacy
  // entries that predate this field.
  const rawUpdated = record.payload.updated_at ?? '';
  const updated = rawUpdated
    ? ENTRY_DATE_FMT.format(new Date(rawUpdated))
    : '—';
  return (
    <li className="group flex items-center gap-3 border-b border-hair py-3 last:border-b-0">
      <button
        type="button"
        onClick={onOpen}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-accent"
      >
        <p className="text-[14px] font-medium text-ink group-hover:text-accent">
          Bilan {record.payload.year}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          Mis à jour le {updated}
        </p>
      </button>

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label="Modifier le bilan"
          title="Modifier"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer le bilan"
          title="Supprimer"
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
  const savedLabel =
    draft.savedAt != null
      ? `Modifié le ${DRAFT_DATETIME_FMT.format(new Date(draft.savedAt))}`
      : 'En cours';
  return (
    <li className="group flex items-center gap-3 border-b border-hair py-3 last:border-b-0">
      <button
        type="button"
        onClick={onResume}
        className="min-w-0 flex-1 cursor-pointer text-left transition-colors hover:text-accent"
      >
        <p className="flex items-baseline gap-2 text-[14px] font-medium text-ink group-hover:text-accent">
          Bilan {draft.year}
          <span className="rounded-sm bg-accent-soft px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] text-accent-deep">
            Brouillon
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
        Reprendre
      </Button>
      <HoverActions>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer le brouillon"
          title="Supprimer le brouillon"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </li>
  );
}
