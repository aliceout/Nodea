import { useEffect, useMemo, useState } from 'react';
import { Bars3Icon, PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';
import {
  MOOD_SCORE_VALUES,
  type MoodPayload,
  type MoodScore,
} from '@nodea/shared';

import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
} from '@/core/store/nodea-store';
import type { DecryptedRecord } from '@/core/api/modules/collection-client';
import { cn } from '@/lib/utils';

/**
 * Mood — Direction K · Sauge.
 *
 * Single detail view (no more tabs): a 30-day note timeline + the
 * latest entries listed in the canonical Mood shape — three
 * positives, a -2..+2 note, an optional "question du jour" answer
 * and an optional free-form comment. Emoji has been dropped per
 * the redesign; old entries that still carry one are read-tolerant
 * via `MoodPayloadSchema.mood_emoji.optional()`.
 *
 * Data is mocked while the redesign settles — actual wiring to the
 * encrypted `mood_entries` collection happens in a follow-up commit
 * once the UI shape is locked.
 */
type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; entries: MoodEntry[] }
  | { status: 'error'; message: string };

export default function MoodPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['mood']?.moduleUserId ?? null;
  const moodVersion = useNodeaStore((s) => s.moodVersion);

  // `null` ("En cours") is the default — rolling 52 weeks ending
  // today, mirroring GitHub's landing view. A specific year flips to
  // calendar mode (full year for past years, Jan 1 → today for the
  // current year).
  const [year, setYear] = useState<number | null>(null);
  const [month, setMonth] = useState<number | null>(null);
  const [load, setLoad] = useState<LoadState>({ status: 'idle' });

  // Reset month when switching years so a stale "Mars" filter
  // doesn't silently empty the list when jumping into a year
  // where that month has no entries yet.
  function handleYearChange(next: number | null): void {
    setYear(next);
    setMonth(null);
  }

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    setLoad({ status: 'loading' });
    moodClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const entries = records
          .map((r) => recordToEntry(r, today))
          // Newest first — the EntryRow list reads top-down.
          .sort((a, b) => b.dateIso.localeCompare(a.dateIso));
        setLoad({ status: 'ready', entries });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message =
          err instanceof Error ? err.message : 'Erreur lors du chargement des entrées Mood.';
        setLoad({ status: 'error', message });
      });
    return () => {
      cancelled = true;
    };
    // `moodVersion` is bumped by the Composer's MoodBody after a
    // successful create — including it here re-runs the fetch so a
    // newly saved mood entry shows up without a page reload.
  }, [mainKey, moduleUserId, moodVersion]);

  const totalEntries = load.status === 'ready' ? load.entries.length : 0;
  const sideEntries: ReadonlyArray<MoodEntry> =
    load.status === 'ready' ? load.entries : EMPTY_ENTRIES;
  const bumpMoodVersion = useNodeaStore((s) => s.bumpMoodVersion);

  function handleEdit(entry: MoodEntry): void {
    openComposer('mood', {
      type: 'mood',
      id: entry.id,
      payload: {
        date: entry.dateIso,
        mood_score: entry.score,
        mood_emoji: '',
        positive1: entry.positives[0],
        positive2: entry.positives[1],
        positive3: entry.positives[2],
        comment: entry.comment ?? '',
        ...(entry.question ? { question: entry.question } : {}),
        ...(entry.answer ? { answer: entry.answer } : {}),
      },
    });
  }

  async function handleDelete(entry: MoodEntry): Promise<void> {
    if (!mainKey || !moduleUserId) return;
    if (!window.confirm(`Supprimer l’entrée du ${entry.date} ?`)) return;
    const previous = load;
    setLoad((prev) =>
      prev.status === 'ready'
        ? { status: 'ready', entries: prev.entries.filter((e) => e.id !== entry.id) }
        : prev,
    );
    try {
      await moodClient.remove(moduleUserId, mainKey, entry.id);
      bumpMoodVersion();
    } catch (err) {
      setLoad(previous);
      if (import.meta.env.DEV) console.warn('mood: delete failed', err);
    }
  }

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        count={totalEntries}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onNewEntry={() => openComposer('mood')}
      />

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        <PrimaryColumn
          load={load}
          year={year}
          onYearChange={handleYearChange}
          month={month}
          onMonthChange={setMonth}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <SideColumn entries={sideEntries} />
      </div>
    </div>
  );
}

/**
 * Map a decrypted Mood record onto the page-local `MoodEntry`
 * shape. Tolerates legacy values: `mood_emoji` is ignored, and a
 * legacy 0..10 `mood_score` gets linearly mapped onto −2..+2 so
 * older entries don't disappear under the new scale.
 */
function recordToEntry(
  record: DecryptedRecord<MoodPayload>,
  today: Date,
): MoodEntry {
  const p = record.payload;
  const dateIso = p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date)
    ? p.date.slice(0, 10)
    : record.createdAt.slice(0, 10);
  const positives: [string, string, string] = [
    p.positive1 ?? '',
    p.positive2 ?? '',
    p.positive3 ?? '',
  ];
  const entry: MoodEntry = {
    id: record.id,
    dateIso,
    date: formatEntryLabel(dateIso, today),
    score: normalizeScore(p.mood_score ?? '0'),
    positives,
  };
  if (p.comment && p.comment.trim().length > 0) entry.comment = p.comment;
  if (p.question && p.question.trim().length > 0) entry.question = p.question;
  if (p.answer && p.answer.trim().length > 0) entry.answer = p.answer;
  return entry;
}

const VALID_SCORES: ReadonlySet<string> = new Set(MOOD_SCORE_VALUES);

function normalizeScore(raw: string): MoodScore {
  if (VALID_SCORES.has(raw)) return raw as MoodScore;
  // Legacy 0..10 scale → linear map onto −2..+2.
  const n = Number(raw);
  if (!Number.isFinite(n)) return '0';
  const mapped = Math.max(-2, Math.min(2, Math.round((n - 5) / 2.5)));
  return String(mapped) as MoodScore;
}

const ENTRY_SAME_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
});
const ENTRY_CROSS_YEAR_FMT = new Intl.DateTimeFormat('fr-FR', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

function formatEntryLabel(dateIso: string, today: Date): string {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return dateIso;
  const dayMs = 24 * 3600 * 1000;
  const diff = Math.floor((today.getTime() - d.getTime()) / dayMs);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Hier';
  const fmt =
    d.getFullYear() === today.getFullYear() ? ENTRY_SAME_YEAR_FMT : ENTRY_CROSS_YEAR_FMT;
  const formatted = fmt.format(d);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

interface TopbarProps {
  count: number;
  onOpenMenu: () => void;
  onNewEntry: () => void;
}

function Topbar({ count, onOpenMenu, onNewEntry }: TopbarProps) {
  const label = `Mood · ${count} ${count === 1 ? 'entrée' : 'entrées'}`;
  return (
    <div className="sticky top-0 z-20 flex h-[52px] items-center justify-between border-b border-hair bg-bg px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] tracking-[0.02em] text-muted">{label}</span>
      </div>

      <button
        type="button"
        onClick={onNewEntry}
        className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
      >
        + Nouvelle entrée
      </button>
    </div>
  );
}

interface MoodEntry {
  /** Decrypted record id — needed by edit / delete handlers. */
  id: string;
  /** ISO `YYYY-MM-DD` — drives year/month filtering. */
  dateIso: string;
  /** Display label computed from `dateIso` + today (today/yesterday/full date). */
  date: string;
  score: MoodScore;
  positives: [string, string, string];
  comment?: string;
  question?: string;
  answer?: string;
}

const EMPTY_ENTRIES: ReadonlyArray<MoodEntry> = [];

interface PrimaryColumnProps {
  load: LoadState;
  year: number | null;
  onYearChange: (next: number | null) => void;
  month: number | null;
  onMonthChange: (next: number | null) => void;
  onEdit: (entry: MoodEntry) => void;
  onDelete: (entry: MoodEntry) => void | Promise<void>;
}

function PrimaryColumn({
  load,
  year,
  onYearChange,
  month,
  onMonthChange,
  onEdit,
  onDelete,
}: PrimaryColumnProps) {
  const entries: ReadonlyArray<MoodEntry> =
    load.status === 'ready' ? load.entries : EMPTY_ENTRIES;

  // Years available in the dataset, sorted descending. Falls back to
  // the current year if the entries collection is empty so the
  // selector never goes blank.
  const availableYears = useMemo<number[]>(() => {
    const set = new Set<number>(entries.map((e) => Number(e.dateIso.slice(0, 4))));
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [entries]);

  // Date range to filter the entries list against. Mirrors the
  // frise's `rangeFor()` (`dataEnd`, not `end` — for the current
  // year the frise visually extends to Dec 31 but data stops at
  // today, and the entries list should match the data, not the
  // visual extent).
  const filtered = useMemo<MoodEntry[]>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { start, dataEnd } = rangeFor(year, today);
    const startTime = start.getTime();
    const dataEndTime = dataEnd.getTime();
    return entries.filter((entry) => {
      const d = new Date(entry.dateIso);
      const t = d.getTime();
      if (t < startTime || t > dataEndTime) return false;
      if (month !== null && d.getMonth() !== month) return false;
      return true;
    });
  }, [entries, year, month]);

  // Stats for the page header — total entry count + 30-day rolling
  // mean score. Mean is computed only over entries that fall in the
  // last 30 days; rounded to one decimal so the header doesn't
  // jitter as new entries land.
  const stats = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cutoff = today.getTime() - 30 * 24 * 3600 * 1000;
    const recent = entries.filter((e) => new Date(e.dateIso).getTime() >= cutoff);
    if (recent.length === 0) {
      return { total: entries.length, avg: null as number | null };
    }
    const sum = recent.reduce((acc, e) => acc + Number(e.score), 0);
    return { total: entries.length, avg: Math.round((sum / recent.length) * 10) / 10 };
  }, [entries]);

  function formatAvg(avg: number | null): string {
    if (avg === null) return '—';
    const sign = avg > 0 ? '+' : avg < 0 ? '−' : '';
    const abs = Math.abs(avg).toFixed(1).replace('.', ',');
    return `${sign}${abs}`;
  }

  // Section heading describes the selected range plain-language so
  // a screen reader (and a glance) reads cleanly: "Entrées · En
  // cours", "Entrées · 2025 · mars", etc. Month is suppressed for
  // the rolling selection because the rolling window straddles
  // months by design.
  const yearLabel = year === null ? 'En cours' : String(year);
  const showMonth = year !== null && month !== null;

  return (
    <section className="flex min-w-0 flex-col">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <div>
          <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
            Mood
          </h1>
          <p className="mt-1 text-[14px] text-muted">
            {stats.total} {stats.total === 1 ? 'entrée' : 'entrées'} · moyenne mobile{' '}
            <span className="font-semibold text-ink">{formatAvg(stats.avg)}</span> sur 30 j
            (échelle −2 → +2)
          </p>
        </div>
        <YearSelector value={year} years={availableYears} onChange={onYearChange} />
      </div>

      <div className="mt-6">
        <Chart year={year} entries={entries} />
      </div>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mt-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div className="mt-2 mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
          Entrées · {yearLabel}
          {showMonth ? ` · ${MONTH_LABELS_LONG[month]}` : ''}
        </h2>
        {year !== null ? (
          <MonthSelector value={month} onChange={onMonthChange} />
        ) : null}
      </div>

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Chargement des entrées…
          </p>
        ) : filtered.length === 0 ? (
          <p className="border-b border-hair py-6 text-[13px] italic text-muted">
            Aucune entrée pour cette période.
          </p>
        ) : (
          filtered.map((entry) => (
            <EntryRow
              key={entry.id}
              entry={entry}
              onEdit={() => onEdit(entry)}
              onDelete={() => onDelete(entry)}
            />
          ))
        )}
      </div>
    </section>
  );
}

const MONTH_LABELS_LONG: ReadonlyArray<string> = [
  'janvier',
  'février',
  'mars',
  'avril',
  'mai',
  'juin',
  'juillet',
  'août',
  'septembre',
  'octobre',
  'novembre',
  'décembre',
];

const MONTH_LABELS_SHORT: ReadonlyArray<string> = [
  'Janv',
  'Févr',
  'Mars',
  'Avr',
  'Mai',
  'Juin',
  'Juil',
  'Août',
  'Sept',
  'Oct',
  'Nov',
  'Déc',
];

interface YearSelectorProps {
  value: number | null;
  years: ReadonlyArray<number>;
  onChange: (next: number | null) => void;
}

function YearSelector({ value, years, onChange }: YearSelectorProps) {
  return (
    <div role="tablist" aria-label="Année" className="flex flex-wrap gap-1">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(
          'cursor-pointer rounded-md px-2.5 py-1 text-[12px] transition-colors',
          value === null
            ? 'bg-accent text-white'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        En cours
      </button>
      {years.map((y) => {
        const active = y === value;
        return (
          <button
            key={y}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(y)}
            className={cn(
              'cursor-pointer rounded-md px-2.5 py-1 text-[12px] tabular-nums transition-colors',
              active
                ? 'bg-accent text-white'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            {y}
          </button>
        );
      })}
    </div>
  );
}

interface MonthSelectorProps {
  value: number | null;
  onChange: (next: number | null) => void;
}

function MonthSelector({ value, onChange }: MonthSelectorProps) {
  return (
    <div role="tablist" aria-label="Mois" className="flex flex-wrap gap-1">
      <button
        type="button"
        role="tab"
        aria-selected={value === null}
        onClick={() => onChange(null)}
        className={cn(
          'cursor-pointer rounded-md px-2 py-0.5 text-[11px] transition-colors',
          value === null
            ? 'bg-accent-soft font-semibold text-accent-deep'
            : 'text-muted hover:bg-bg-2 hover:text-ink',
        )}
      >
        Tous
      </button>
      {MONTH_LABELS_SHORT.map((label, i) => {
        const active = value === i;
        return (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(i)}
            className={cn(
              'cursor-pointer rounded-md px-2 py-0.5 text-[11px] transition-colors',
              active
                ? 'bg-accent-soft font-semibold text-accent-deep'
                : 'text-muted hover:bg-bg-2 hover:text-ink',
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

const SCORE_FILL: Record<MoodScore, string> = {
  '2': 'bg-accent',
  '1': 'bg-accent-soft',
  // `bg-hair` instead of `bg-bg-2`: empty cells (no entry) render
  // with a faint hair-coloured *outline*, so a solid hair *fill*
  // for score 0 reads as "filled neutral" without competing with
  // the ±1 soft tints. Going `outline → neutral fill → tinted fill
  // → saturated fill` removes the ambiguity between "no entry" and
  // "neutral entry".
  '0': 'bg-hair',
  '-1': 'bg-low-soft',
  '-2': 'bg-low',
};

/**
 * GitHub-style mood frise. 52 columns of weeks (rolling year — when
 * the current year isn't complete, the trailing weeks come from
 * last year, exactly like GitHub's contribution graph), 7 rows of
 * days (Mon..Sun, French convention). Each cell is colour-coded by
 * score; days without an entry render as a faint outline so the
 * grid stays legible without faking data. Today carries an accent
 * ring; cells after today (rest of this week) drop out.
 *
 * Cell sizing uses `1fr` columns + `aspect-square`, so the frise
 * stretches to fill the primary content column without needing a
 * horizontal scrollbar.
 */
const HEATMAP_WEEKS = 52;
const HEATMAP_DAYS_PER_WEEK = 7;

interface HeatmapCell {
  score: MoodScore;
  isToday: boolean;
  /** Pre-formatted French label for the cell's date (`lundi 30 mars`,
   * with the year appended only when it differs from today's year).
   * Used for the hover tooltip. */
  dateLabel: string;
}

interface MonthLabel {
  /** Index of the week this label sits over (0 = oldest, 51 = current). */
  weekIndex: number;
  label: string;
}

interface ChartProps {
  /** Year selection driving the frise.
   *
   * - `null` ("En cours") — rolling 52 weeks ending today.
   * - `currentYear` — Jan 1 of the current year through today
   *   (partial year so far; leading weeks before Jan 1 render
   *   as empty cells).
   * - past year — Jan 1 → Dec 31 of that year. */
  year: number | null;
  entries: ReadonlyArray<MoodEntry>;
}

function Chart({ year, entries }: ChartProps) {
  const { cells, monthLabels } = buildHeatmap(year, entries);
  const dayLabels = ['Lun', '', 'Mer', '', 'Ven', '', 'Dim'];

  return (
    <div
      className="mb-7 grid gap-x-1 gap-y-[3px]"
      aria-hidden="true"
      style={{
        gridTemplateColumns: `28px repeat(${HEATMAP_WEEKS}, minmax(0, 1fr))`,
        gridTemplateRows: `14px repeat(${HEATMAP_DAYS_PER_WEEK}, auto)`,
      }}
    >
      {/* Top-left empty corner — one cell to keep grid alignment crisp. */}
      <span aria-hidden="true" style={{ gridRow: 1, gridColumn: 1 }} />

      {/* Month labels along the top, positioned over the first week
          where each calendar month appears in the rolling year. */}
      {monthLabels.map(({ weekIndex, label }) => (
        <span
          key={`${weekIndex}-${label}`}
          className="text-[10px] leading-none text-muted"
          style={{ gridRow: 1, gridColumn: weekIndex + 2 }}
        >
          {label}
        </span>
      ))}

      {/* Day-of-week labels down the left, every other row. */}
      {dayLabels.map((label, i) => (
        <span
          key={i}
          className="text-right text-[10px] leading-none text-muted"
          style={{ gridRow: i + 2, gridColumn: 1 }}
        >
          {label}
        </span>
      ))}

      {/* Heatmap cells, column-major within the (52 × 7) sub-grid. */}
      {cells.map((cell, i) => {
        const weekIndex = Math.floor(i / HEATMAP_DAYS_PER_WEEK);
        const dayOfWeek = i % HEATMAP_DAYS_PER_WEEK;
        const style = { gridRow: dayOfWeek + 2, gridColumn: weekIndex + 2 };
        if (cell === null) {
          return (
            <span
              key={i}
              aria-hidden="true"
              className="aspect-square rounded-[2px] border border-hair/70"
              style={style}
            />
          );
        }
        const signed = Number(cell.score) > 0 ? `+${cell.score}` : cell.score;
        return (
          <span
            key={i}
            title={`${cell.dateLabel} · ${signed}`}
            className={cn(
              'aspect-square rounded-[2px]',
              SCORE_FILL[cell.score],
              cell.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
            )}
            style={style}
          />
        );
      })}

      {/* Legend, spanning the full width below the grid. */}
      <ul
        className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-3 text-[11px] text-muted"
        style={{ gridRow: HEATMAP_DAYS_PER_WEEK + 2, gridColumn: `2 / span ${HEATMAP_WEEKS}` }}
      >
        {(['-2', '-1', '0', '1', '2'] as MoodScore[]).map((score) => (
          <li key={score} className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className={cn('h-3 w-3 rounded-[2px]', SCORE_FILL[score])}
            />
            <span className="tabular-nums text-ink-soft">
              {Number(score) > 0 ? `+${score}` : score}
            </span>
            <span>{SCORE_LABELS[score]}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Date range covered by a year selection.
 *
 * Three values:
 * - `start` / `end`: the visible window — drives the 52-week grid
 *   anchor and the entries list filter. The frise is laid out so
 *   `end`'s week sits in the rightmost column.
 * - `dataEnd`: the latest date that actually carries data. For
 *   the current year this is `today` (the rest of the year is
 *   visible but empty); for past years and the rolling view it's
 *   the same as `end`.
 *
 * Modes:
 * - `null` ("En cours"): rolling 52 weeks ending today — bleeds
 *   into the previous calendar year, like GitHub's default view.
 * - `currentYear`: window goes Jan 1 → Dec 31, anchored so
 *   January starts on the left and December ends on the right;
 *   data stops at today, so the rest of the year shows empty.
 * - past year: Jan 1 → Dec 31, fully populated.
 */
function rangeFor(
  year: number | null,
  today: Date,
): { start: Date; end: Date; dataEnd: Date } {
  if (year === null) {
    const start = new Date(today);
    start.setDate(today.getDate() - HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK + 1);
    return { start, end: today, dataEnd: today };
  }
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  if (year === today.getFullYear()) {
    return { start: jan1, end: dec31, dataEnd: today };
  }
  return { start: jan1, end: dec31, dataEnd: dec31 };
}

/** Local-TZ ISO date string, no time component. */
function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Project a flat list of `MoodEntry`s onto the 52 × 7 heatmap grid.
 *
 * Cells flow column-major: `cells[0..6]` = oldest column (Mon..Sun),
 * `cells[357..363]` = the most recent week.
 *
 * Single uniform rule per cell:
 * - if the cell's date falls outside `[start, dataEnd]` (computed by
 *   `rangeFor(year, today)`), the cell is `null` (rendered as faint
 *   outline) — keeps the trailing weeks of the current year visible
 *   but empty;
 * - else, look the cell's `dateIso` up in the entries map: a hit
 *   becomes a coloured cell with the matching score; a miss stays
 *   `null` so days without an entry read as gaps, not zeros.
 */
function buildHeatmap(
  year: number | null,
  entries: ReadonlyArray<MoodEntry>,
): {
  cells: Array<HeatmapCell | null>;
  monthLabels: MonthLabel[];
} {
  const total = HEATMAP_WEEKS * HEATMAP_DAYS_PER_WEEK;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const currentYear = today.getFullYear();
  const todayTime = today.getTime();
  const { start, end, dataEnd } = rangeFor(year, today);
  const startTime = start.getTime();
  const dataEndTime = dataEnd.getTime();

  // Index entries by ISO date for O(1) lookup per cell.
  const entriesByDate = new Map<string, MoodScore>();
  for (const entry of entries) entriesByDate.set(entry.dateIso, entry.score);

  // Anchor at the oldest visible Monday — `end`'s week's Monday
  // minus 51 weeks. From there, cell index `i` maps to a calendar
  // date by `i` days (column-major flow walks the same way:
  // Mon..Sun of week 0, then Mon..Sun of week 1, …).
  const endDow = (end.getDay() + 6) % 7;
  const lastWeekMonday = new Date(end);
  lastWeekMonday.setDate(end.getDate() - endDow);
  const oldestMonday = new Date(lastWeekMonday);
  oldestMonday.setDate(lastWeekMonday.getDate() - (HEATMAP_WEEKS - 1) * 7);

  const sameYearFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const crossYearFmt = new Intl.DateTimeFormat('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const cells: Array<HeatmapCell | null> = [];
  for (let i = 0; i < total; i++) {
    const cellDate = new Date(oldestMonday);
    cellDate.setDate(oldestMonday.getDate() + i);
    const t = cellDate.getTime();
    if (t < startTime || t > dataEndTime) {
      cells.push(null);
      continue;
    }
    const score = entriesByDate.get(toIsoDate(cellDate));
    if (!score) {
      // Day in range but no entry — show as faint gap, not zero.
      cells.push(null);
      continue;
    }
    const fmt = cellDate.getFullYear() === currentYear ? sameYearFmt : crossYearFmt;
    cells.push({
      score,
      isToday: t === todayTime,
      dateLabel: fmt.format(cellDate),
    });
  }

  // Month labels: every time a week's Monday lands in a different
  // calendar month than the previous week's Monday, drop a label.
  const monthFormatter = new Intl.DateTimeFormat('fr-FR', { month: 'short' });
  const monthLabels: MonthLabel[] = [];
  let prevMonth = -1;
  for (let w = 0; w < HEATMAP_WEEKS; w++) {
    const weeksAgo = HEATMAP_WEEKS - 1 - w;
    const monday = new Date(lastWeekMonday);
    monday.setDate(lastWeekMonday.getDate() - weeksAgo * 7);
    if (monday.getMonth() !== prevMonth) {
      monthLabels.push({ weekIndex: w, label: monthFormatter.format(monday) });
      prevMonth = monday.getMonth();
    }
  }
  return { cells, monthLabels };
}

const SCORE_LABELS: Record<MoodScore, string> = {
  '-2': 'très bas',
  '-1': 'bas',
  '0': 'neutre',
  '1': 'bon',
  '2': 'très bon',
};

interface EntryRowProps {
  entry: MoodEntry;
  onEdit: () => void;
  onDelete: () => void;
}

function EntryRow({ entry, onEdit, onDelete }: EntryRowProps) {
  return (
    <article className="group grid grid-cols-[110px_44px_1fr_auto] items-baseline gap-4 border-b border-hair py-4">
      <div className="text-[12px] tabular-nums text-muted">{entry.date}</div>
      <NoteBadge score={entry.score} />
      <div className="min-w-0">
        <ul className="space-y-0.5">
          {entry.positives
            .filter((p) => p.trim().length > 0)
            .map((p, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-ink"
              >
                <span aria-hidden="true" className="mt-0.5 text-[10px] text-muted">
                  ·
                </span>
                <span>{p}</span>
              </li>
            ))}
        </ul>
        {entry.comment ? (
          <p className="mt-1.5 text-[12px] italic leading-[1.5] text-ink-soft">
            {entry.comment}
          </p>
        ) : null}
        {entry.question ? (
          <div className="mt-1.5 text-[12px] text-muted">
            <span className="font-semibold tracking-[0.02em]">Q.</span>{' '}
            <span className="italic">{entry.question}</span>
            {entry.answer ? (
              <>
                {' — '}
                <span className="text-ink">{entry.answer}</span>
              </>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          aria-label="Modifier l’entrée"
          title="Modifier"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-bg-2 hover:text-ink"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Supprimer l’entrée"
          title="Supprimer"
          className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted transition-colors hover:bg-danger/10 hover:text-danger"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </article>
  );
}

const SCORE_TONE: Record<MoodScore, string> = {
  '2': 'bg-accent text-white',
  '1': 'bg-accent-soft text-accent-deep',
  '0': 'bg-bg-2 text-ink-soft',
  '-1': 'bg-low-soft text-low-deep',
  '-2': 'bg-low text-white',
};

function NoteBadge({ score }: { score: MoodScore }) {
  const numeric = Number(score);
  const display = numeric > 0 ? `+${score}` : score;
  return (
    <span
      className={cn(
        'inline-flex h-[26px] min-w-[36px] items-center justify-center rounded-md px-1.5 text-[12px] font-semibold tabular-nums',
        SCORE_TONE[score],
      )}
    >
      {display}
    </span>
  );
}

interface Pattern {
  label: string;
  delta: string;
}

/**
 * Patterns are computed over `{date, score}` only — no external
 * signals (sleep, calendar, weather…) because the app doesn't
 * capture them; surfacing fake correlations undermines trust.
 *
 * Three signals, each surfaced only when the data supports it:
 *  - best / worst day of the week (mean score per weekday vs the
 *    overall mean, requires ≥ 3 entries on the day to dampen
 *    one-shot noise).
 *  - longest non-negative streak — counts consecutive entries (not
 *    calendar days), so a missed day doesn't break the streak.
 *  - 30-day rolling mean vs 90-day rolling mean, only shown when
 *    the gap is meaningful (≥ 0.2 on the −2..+2 scale).
 */
function SideColumn({ entries }: { entries: ReadonlyArray<MoodEntry> }) {
  const patterns = useMemo(() => computePatterns(entries), [entries]);

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel>Distribution</SectionLabel>
        <ScoreDonut entries={entries} />
      </section>

      <section>
        <SectionLabel>Patterns</SectionLabel>
        {patterns.length === 0 ? (
          <p className="border-b border-hair py-2.5 text-[12px] italic text-muted">
            Pas encore assez d’entrées pour dégager des motifs.
          </p>
        ) : (
          <ul>
            {patterns.map((p) => (
              <li key={p.label} className="border-b border-hair py-2.5 last:border-b-0">
                <div className="text-[13px] font-medium text-ink">{p.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">{p.delta}</div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}

const DAY_NAMES_FR: ReadonlyArray<string> = [
  'Lundi',
  'Mardi',
  'Mercredi',
  'Jeudi',
  'Vendredi',
  'Samedi',
  'Dimanche',
];

const SHORT_MONTHS_FR: ReadonlyArray<string> = [
  'janv.',
  'févr.',
  'mars',
  'avr.',
  'mai',
  'juin',
  'juil.',
  'août',
  'sept.',
  'oct.',
  'nov.',
  'déc.',
];

function computePatterns(entries: ReadonlyArray<MoodEntry>): Pattern[] {
  const out: Pattern[] = [];
  if (entries.length < 5) return out;

  // 1) Best / worst day of the week
  const buckets: number[][] = [[], [], [], [], [], [], []]; // Mon..Sun
  for (const e of entries) {
    const d = new Date(e.dateIso);
    if (Number.isNaN(d.getTime())) continue;
    const dow = (d.getDay() + 6) % 7; // shift Sun=0..Sat=6 → Mon=0..Sun=6
    buckets[dow]!.push(Number(e.score));
  }
  const allScores = entries.map((e) => Number(e.score));
  const overallMean = allScores.reduce((s, v) => s + v, 0) / allScores.length;
  const MIN_PER_DAY = 3;
  let bestIdx = -1;
  let worstIdx = -1;
  let bestMean = -Infinity;
  let worstMean = Infinity;
  for (let i = 0; i < 7; i += 1) {
    const bucket = buckets[i]!;
    if (bucket.length < MIN_PER_DAY) continue;
    const mean = bucket.reduce((s, v) => s + v, 0) / bucket.length;
    if (mean > bestMean) {
      bestMean = mean;
      bestIdx = i;
    }
    if (mean < worstMean) {
      worstMean = mean;
      worstIdx = i;
    }
  }
  if (bestIdx >= 0) {
    out.push({
      label: `${DAY_NAMES_FR[bestIdx]} est ton meilleur jour`,
      delta: `${signedFormat(bestMean - overallMean)} vs moyenne`,
    });
  }
  if (worstIdx >= 0 && worstIdx !== bestIdx) {
    out.push({
      label: `${DAY_NAMES_FR[worstIdx]} reste ton point bas`,
      delta: `${signedFormat(worstMean - overallMean)} vs moyenne`,
    });
  }

  // 2) Longest non-negative streak (consecutive entries, gaps OK)
  const sortedAsc = [...entries].sort((a, b) => a.dateIso.localeCompare(b.dateIso));
  let current = 0;
  let currentStart: string | null = null;
  let bestCount = 0;
  let bestStart: string | null = null;
  let bestEnd: string | null = null;
  for (const e of sortedAsc) {
    if (Number(e.score) >= 0) {
      if (current === 0) currentStart = e.dateIso;
      current += 1;
      if (current > bestCount) {
        bestCount = current;
        bestStart = currentStart;
        bestEnd = e.dateIso;
      }
    } else {
      current = 0;
      currentStart = null;
    }
  }
  if (bestCount >= 3 && bestStart && bestEnd) {
    out.push({
      label: `${bestCount} entrées ≥ 0 d’affilée`,
      delta: formatStreakRange(bestStart, bestEnd),
    });
  }

  // 3) 30-day mean vs 90-day mean (trend)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dayMs = 24 * 3600 * 1000;
  const cutoff30 = today.getTime() - 30 * dayMs;
  const cutoff90 = today.getTime() - 90 * dayMs;
  const last30: number[] = [];
  const last90: number[] = [];
  for (const e of entries) {
    const t = new Date(e.dateIso).getTime();
    if (Number.isNaN(t)) continue;
    if (t >= cutoff30) last30.push(Number(e.score));
    if (t >= cutoff90) last90.push(Number(e.score));
  }
  if (last30.length >= 5 && last90.length >= 10) {
    const m30 = last30.reduce((s, v) => s + v, 0) / last30.length;
    const m90 = last90.reduce((s, v) => s + v, 0) / last90.length;
    const delta = m30 - m90;
    if (Math.abs(delta) >= 0.2) {
      out.push({
        label: delta > 0 ? 'Tendance à la hausse' : 'Tendance à la baisse',
        delta: `${signedFormat(delta)} vs 90 j`,
      });
    }
  }

  return out;
}

function signedFormat(value: number): string {
  const sign = value > 0 ? '+' : value < 0 ? '−' : '';
  const abs = Math.abs(value).toFixed(1).replace('.', ',');
  return `${sign}${abs}`;
}

function formatStreakRange(startIso: string, endIso: string): string {
  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return `${startIso} → ${endIso}`;
  }
  if (startIso === endIso) {
    return `le ${formatShortDate(start)}`;
  }
  // If start and end share a year, drop the year from the start (less noise).
  if (start.getFullYear() === end.getFullYear()) {
    return `du ${start.getDate()} ${SHORT_MONTHS_FR[start.getMonth()]} au ${formatShortDate(end)}`;
  }
  return `du ${formatShortDate(start)} au ${formatShortDate(end)}`;
}

function formatShortDate(d: Date): string {
  return `${d.getDate()} ${SHORT_MONTHS_FR[d.getMonth()]} ${d.getFullYear()}`;
}

const SCORE_STROKE: Record<MoodScore, string> = {
  '2': 'stroke-accent',
  '1': 'stroke-accent-soft',
  '0': 'stroke-muted-soft',
  '-1': 'stroke-low-soft',
  '-2': 'stroke-low',
};

/**
 * Text-fill ramp for the donut's per-segment labels. Mirrors the
 * magnitude of the score: extreme values (`+2` / `-2`) get the
 * deep shade of their family, mild values (`+1` / `-1`) the medium
 * shade, neutral stays muted. Always a readable tone — the soft
 * variants used by the segments themselves would be invisible as
 * text on the page background.
 */
const SCORE_LABEL_FILL: Record<MoodScore, string> = {
  '2': 'fill-accent-deep',
  '1': 'fill-accent',
  '0': 'fill-ink-soft',
  '-1': 'fill-low',
  '-2': 'fill-low-deep',
};

const DONUT_ORDER: ReadonlyArray<MoodScore> = ['2', '1', '0', '-1', '-2'];

/**
 * Score distribution rendered as an empty-centre donut. Each arc is
 * a `<circle>` with a `stroke-dasharray` carving a slice; segments
 * sit on a faint `bg-2` track so a missing score still reads as
 * "0 of N" instead of disappearing.
 *
 * Hover a segment to fill the centre with that score's NoteBadge +
 * entry count. Other segments dim while a segment is being hovered
 * so the focus is unambiguous.
 */
function ScoreDonut({ entries }: { entries: ReadonlyArray<MoodEntry> }) {
  const [hovered, setHovered] = useState<MoodScore | null>(null);
  const counts: Record<MoodScore, number> = { '2': 0, '1': 0, '0': 0, '-1': 0, '-2': 0 };
  for (const e of entries) counts[e.score] += 1;
  const total = entries.length;

  // Geometry: the SVG is 100×100 in user units. The track + arcs are
  // drawn at radius 42 with a 12-unit stroke, leaving a hollow centre.
  const cx = 50;
  const cy = 50;
  const r = 42;
  const stroke = 12;
  const circumference = 2 * Math.PI * r;
  // Tiny visual gap between segments (in user units along the path).
  const gap = total > 0 ? 0.6 : 0;

  let cursor = 0;
  const arcs = DONUT_ORDER.map((score) => {
    if (total === 0) {
      return { score, length: 0, offset: 0, count: 0, midAngle: 0 };
    }
    const fraction = counts[score] / total;
    const length = Math.max(0, fraction * circumference - gap);
    // Mid-angle of the arc in the rotated frame — the donut group is
    // rotated -90° below so cell 0 starts at 12 o'clock; offsetting
    // the angle by -π/2 here keeps the label maths in sync with what
    // the eye actually sees.
    const startRad = (cursor / circumference) * 2 * Math.PI - Math.PI / 2;
    const arcRad = (fraction * 2 * Math.PI);
    const midAngle = startRad + arcRad / 2;
    const arc = { score, length, offset: cursor, count: counts[score], midAngle };
    cursor += fraction * circumference;
    return arc;
  });

  const hoveredCount = hovered !== null ? counts[hovered] : 0;
  // Label radius — sits just outside the donut's outer edge
  // (centerline at 42 + half-stroke 6 = 48, label at 58 leaves a
  // small gap so text doesn't hug the arc).
  const labelR = 58;

  return (
    <div className="relative mx-auto h-[180px] w-[180px]">
      <svg
        // viewBox is padded so the labels at radius 58 don't get
        // clipped on any edge.
        viewBox="-15 -15 130 130"
        className="h-full w-full"
        role="img"
        aria-label={`Distribution des notes sur ${total} entrée${total === 1 ? '' : 's'}`}
      >
        {/* Donut group — rotated so the first arc starts at 12 o'clock. */}
        <g transform="rotate(-90 50 50)">
          {/* Track. Always drawn so the donut has shape even when
              there are no entries yet. */}
          <circle
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            strokeWidth={stroke}
            className="stroke-bg-2"
          />
          {arcs.map((arc) =>
            arc.length > 0 ? (
              <circle
                key={arc.score}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                strokeWidth={stroke}
                strokeLinecap="butt"
                onMouseEnter={() => setHovered(arc.score)}
                onMouseLeave={() => setHovered(null)}
                className={cn(
                  SCORE_STROKE[arc.score],
                  'cursor-pointer transition-opacity duration-150',
                  hovered !== null && hovered !== arc.score && 'opacity-30',
                )}
                strokeDasharray={`${arc.length} ${circumference - arc.length}`}
                strokeDashoffset={-arc.offset}
              />
            ) : null,
          )}
        </g>

        {/* Score labels outside each non-empty arc. Rendered without
            the donut's rotation so the text stays upright; the
            angle was already pre-rotated in the arcs array. */}
        {arcs.map((arc) => {
          if (arc.length === 0) return null;
          const x = cx + labelR * Math.cos(arc.midAngle);
          const y = cy + labelR * Math.sin(arc.midAngle);
          const dimmed = hovered !== null && hovered !== arc.score;
          const display = Number(arc.score) > 0 ? `+${arc.score}` : arc.score;
          return (
            <text
              key={arc.score}
              x={x}
              y={y}
              textAnchor="middle"
              dominantBaseline="central"
              className={cn(
                'pointer-events-none text-[9px] font-semibold tabular-nums transition-opacity duration-150',
                SCORE_LABEL_FILL[arc.score],
                dimmed && 'opacity-30',
              )}
            >
              {display}
            </text>
          );
        })}
      </svg>

      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-150">
        {hovered !== null ? (
          <>
            <NoteBadge score={hovered} />
            <span className="mt-2 text-[12px] tabular-nums text-muted">
              {hoveredCount} {hoveredCount === 1 ? 'entrée' : 'entrées'}
            </span>
          </>
        ) : null}
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}
