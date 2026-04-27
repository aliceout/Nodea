import { useState } from 'react';
import { useReview, type ReviewRecord } from '../hooks/useReview';
import Button from '@/ui/atoms/dirk/Button';

interface ListProps {
  onStartNew(year: number): void;
  onOpen(record: ReviewRecord): void;
  onEdit(record: ReviewRecord): void;
}

export default function ReviewListView({ onStartNew, onOpen, onEdit }: ListProps) {
  const { loading, error, entries, deleteReview } = useReview();
  const currentYear = new Date().getFullYear();
  const [draftYear, setDraftYear] = useState<number>(currentYear);

  async function handleDelete(id: string): Promise<void> {
    if (!window.confirm('Supprimer ce bilan annuel ?')) return;
    await deleteReview(id);
  }

  return (
    <div className="mx-auto w-full max-w-2xl space-y-6 py-6">
      <section className="space-y-3 rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <h1 className="text-xl font-bold">Commencer un nouveau bilan</h1>
        <p className="text-sm opacity-80">
          Un parcours guidé en {15} étapes, inspiré du YearCompass. Tu peux
          passer, revenir, et le reprendre quand tu veux — ton brouillon est
          chiffré localement.
        </p>
        <div className="flex items-end gap-3">
          <label className="block">
            <span className="text-xs">Année concernée</span>
            <input
              type="number"
              min={1900}
              max={2200}
              value={draftYear}
              onChange={(e) => setDraftYear(Number(e.target.value) || currentYear)}
              className="mt-1 block w-28 rounded border border-slate-300 p-2 text-sm"
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

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Bilans passés</h2>
        {loading ? <p className="opacity-60">Chargement…</p> : null}
        {error ? <p className="text-red-600">{error}</p> : null}
        {!loading && entries.length === 0 ? (
          <p className="opacity-60">Aucun bilan enregistré pour le moment.</p>
        ) : null}
        <ul className="space-y-2">
          {entries.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900"
            >
              <div>
                <p className="font-semibold">Bilan {e.payload.year}</p>
                <p className="text-xs opacity-60">
                  Mis à jour le {new Date(e.updatedAt).toLocaleDateString()}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="neutral" size="sm" onClick={() => onOpen(e)}>
                  Relire
                </Button>
                <Button variant="neutral" size="sm" onClick={() => onEdit(e)}>
                  Modifier
                </Button>
                <Button
                  variant="danger-ghost"
                  size="xs"
                  iconOnly
                  onClick={() => void handleDelete(e.id)}
                  aria-label="Supprimer"
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
