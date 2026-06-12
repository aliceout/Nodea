import { useMemo, useState } from 'react';
import HabitCard from '../components/HabitCard';
import { useHabits, type HabitItem } from '../hooks/useHabits';
import { toIsoDate } from '@/core/i18n/date-format';
import { useAlert, useConfirm } from '@/ui/dirk/confirm/confirm-context';

// `toISOString().slice(0, 10)` would return the UTC day, off by one
// for users east of UTC after their local evening. `toIsoDate` reads
// the local calendar day.
function today(): string {
  return toIsoDate(new Date());
}

export default function HabitsHistoryView() {
  const {
    loading,
    error,
    items,
    logs,
    logOccurrence,
    updateItem,
    deleteItem,
  } = useHabits();

  const confirm = useConfirm();
  const alert = useAlert();

  const [scope, setScope] = useState<'active' | 'archived' | 'all'>('active');

  const visible = useMemo(() => {
    return items.filter((it) => {
      const archived = it.payload.archived === true;
      if (scope === 'active') return !archived;
      if (scope === 'archived') return archived;
      return true;
    });
  }, [items, scope]);

  async function handleLogToday(item: HabitItem): Promise<void> {
    try {
      await logOccurrence(item.id, today());
    } catch (err) {
      await alert({ message: 'Erreur : ' + (err instanceof Error ? err.message : '') });
    }
  }

  async function handleToggleArchive(item: HabitItem): Promise<void> {
    const next = !item.payload.archived;
    try {
      await updateItem(item.id, { ...item.payload, archived: next });
    } catch (err) {
      await alert({ message: 'Erreur : ' + (err instanceof Error ? err.message : '') });
    }
  }

  async function handleDelete(item: HabitItem): Promise<void> {
    const ok = await confirm({
      message: `Supprimer « ${item.payload.title} » et tous ses logs ?`,
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteItem(item.id);
    } catch (err) {
      await alert({ message: 'Erreur : ' + (err instanceof Error ? err.message : '') });
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 py-6">
      <header className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Mes habitudes</h1>
        <div className="flex gap-1 rounded border border-slate-200 p-1 text-xs dark:border-slate-700">
          {(['active', 'archived', 'all'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setScope(s)}
              className={
                'rounded px-2 py-1 ' +
                (scope === s
                  ? 'bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800')
              }
            >
              {s === 'active' ? 'Actives' : s === 'archived' ? 'Archivées' : 'Toutes'}
            </button>
          ))}
        </div>
      </header>

      {loading ? <p className="opacity-60">Chargement…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && visible.length === 0 ? (
        <p className="opacity-60">
          {scope === 'archived'
            ? "Aucune habitude archivée."
            : scope === 'active'
              ? "Aucune habitude active pour le moment."
              : "Aucune habitude enregistrée."}
        </p>
      ) : null}

      <div className="space-y-3">
        {visible.map((it) => (
          <HabitCard
            key={it.id}
            item={it}
            logs={logs}
            onLogToday={() => void handleLogToday(it)}
            onToggleArchive={() => void handleToggleArchive(it)}
            onDelete={() => void handleDelete(it)}
          />
        ))}
      </div>
    </div>
  );
}
