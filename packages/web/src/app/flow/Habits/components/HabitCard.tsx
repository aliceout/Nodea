import type { HabitItem, HabitLog } from '../hooks/useHabits';
import { regularityRate } from '../hooks/useRegularity';
import Heatmap from './Heatmap';
import Button from '@/ui/atoms/dirk/Button';

interface HabitCardProps {
  item: HabitItem;
  logs: HabitLog[];
  onLogToday(): void;
  onToggleArchive(): void;
  onDelete(): void;
}

function formatRate(rate: number | null): string {
  if (rate == null) return '—';
  return `${Math.round(rate * 100)}%`;
}

export default function HabitCard({
  item,
  logs,
  onLogToday,
  onToggleArchive,
  onDelete,
}: HabitCardProps) {
  const logsForItem = logs.filter((l) => l.payload.itemRid === item.id);
  const rate = regularityRate(item, logs);
  const archived = item.payload.archived === true;

  return (
    <article
      className={
        'space-y-3 rounded border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900 ' +
        (archived ? 'opacity-60' : '')
      }
    >
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{item.payload.title}</h3>
          <p className="text-xs opacity-60">
            {item.payload.category} · {item.payload.frequency}
            {item.payload.target ? ` · cible ${item.payload.target}` : ''}
            {item.payload.duration ? ` · ${item.payload.duration}` : ''}
          </p>
        </div>
        <div className="text-right">
          <div className="text-lg font-semibold tabular-nums">{formatRate(rate)}</div>
          <p className="text-xs opacity-60">30 j</p>
        </div>
      </header>

      <Heatmap itemId={item.id} logs={logs} />

      <footer className="flex flex-wrap items-center gap-2">
        <Button
          variant="primary"
          size="sm"
          onClick={onLogToday}
          disabled={archived}
        >
          Log aujourd'hui
        </Button>
        <Button variant="neutral" size="sm" onClick={onToggleArchive}>
          {archived ? 'Désarchiver' : 'Archiver'}
        </Button>
        <span className="flex-1" />
        <span className="text-xs opacity-60">
          {logsForItem.length} log{logsForItem.length > 1 ? 's' : ''} au total
        </span>
        <Button
          variant="danger-ghost"
          size="xs"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer l'habitude"
        >
          ✕
        </Button>
      </footer>
    </article>
  );
}
