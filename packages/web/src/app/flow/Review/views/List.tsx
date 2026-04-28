import { useMemo, useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import { useNodeaStore } from '@/core/store/nodea-store';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import EmptyHint from '@/ui/dirk/EmptyHint';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';
import { useReview, type ReviewRecord } from '../hooks/useReview';

interface ListProps {
  onStartNew(year: number): void;
  onOpen(record: ReviewRecord): void;
  onEdit(record: ReviewRecord): void;
}

const ENTRY_DATE_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export default function ReviewListView({ onStartNew, onOpen, onEdit }: ListProps) {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { loading, error, entries, deleteReview } = useReview();
  const currentYear = new Date().getFullYear();
  const [draftYear, setDraftYear] = useState<number>(currentYear);

  const sorted = useMemo(
    () => [...entries].sort((a, b) => b.payload.year - a.payload.year),
    [entries],
  );

  async function handleDelete(record: ReviewRecord): Promise<void> {
    if (!window.confirm(`Supprimer le bilan ${record.payload.year} ?`)) return;
    await deleteReview(record.id);
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
          Un parcours guidé en 15 étapes, inspiré du YearCompass. Tu peux passer,
          revenir, et le reprendre quand tu veux — ton brouillon est chiffré
          localement.
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

      {loading && sorted.length === 0 ? (
        <EmptyHint>Chargement des bilans…</EmptyHint>
      ) : sorted.length === 0 ? (
        <EmptyHint>Aucun bilan enregistré pour le moment.</EmptyHint>
      ) : (
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
  const updated = ENTRY_DATE_FMT.format(new Date(record.updatedAt));
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
