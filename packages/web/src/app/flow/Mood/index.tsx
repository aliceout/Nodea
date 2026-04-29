import { useMemo, useState } from 'react';
import {
  ChevronUpIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import { type MoodScore } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import EmptyHint from '@/ui/dirk/EmptyHint';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

import {
  MoodProvider,
  useMoodActions,
  useMoodData,
  useMoodFilters,
} from './context';
import {
  DONUT_ORDER,
  MONTH_LABELS_LONG,
  MONTH_LABELS_SHORT,
  SCORE_FILL,
  SCORE_LABEL_FILL,
  SCORE_LABELS,
  SCORE_STROKE,
  SCORE_TONE,
} from './lib/constants';
import {
  buildHeatmap,
  HEATMAP_DAYS_PER_WEEK,
  HEATMAP_WEEKS,
} from './lib/heatmap';
import {
  computeAverage30d,
  computePatterns,
  formatMoodAvg,
} from './lib/stats';
import type { LoadState, MoodEntry } from './lib/types';

/**
 * Mood — Direction K · Sauge.
 *
 * Single detail view (no more tabs) : a 52 × 7 heatmap of mood
 * scores + the latest entries listed in the canonical Mood shape —
 * three positives, a −2..+2 note, an optional « question du jour »
 * answer and an optional free-form comment. Emoji has been dropped
 * per the redesign ; old entries that still carry one are
 * read-tolerant via `MoodPayloadSchema.mood_emoji.optional()`.
 *
 * Architecture (matches Library / Goals / Journal) :
 *   - `<MoodProvider>` (`./context.tsx`) owns the page-local state
 *     — entries, filters (year / month / chart fold), actions.
 *   - Three hooks (`useMoodData`, `useMoodFilters`, `useMoodActions`)
 *     expose the slices ; consumers re-render only on the slice
 *     they read.
 *   - Sub-components (heatmap, sidebar donut, entry row, year /
 *     month selectors) keep their prop API for now — Steps 3 & 4
 *     of the refacto roadmap will migrate them to read directly
 *     from the contexts.
 *   - Pure helpers in `lib/` (mappers, date-format, heatmap, stats)
 *     carry the Vitest coverage.
 */
export default function MoodPage() {
  return (
    <MoodProvider>
      <MoodView />
    </MoodProvider>
  );
}

/** Thin shell that pulls state from the three Mood contexts and
 *  hands it down as props to the still-prop-driven sub-components.
 *  The inner views are migrated to direct context reads in the
 *  next refacto step. */
function MoodView() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { entries, load } = useMoodData();
  const { year, month, chartCollapsed, setYear, setMonth, toggleChart } =
    useMoodFilters();
  const { editEntry, deleteEntry } = useMoodActions();

  const totalEntries = entries.length;

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Mood · ${totalEntries} ${totalEntries === 1 ? 'entrée' : 'entrées'}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="primary" size="sm" onClick={() => openComposer('mood')}>
            + Nouvelle entrée
          </Button>
        </Topbar>
      }
      side={<SideColumn entries={entries} />}
    >
      <PrimaryColumn
        load={load}
        year={year}
        onYearChange={setYear}
        month={month}
        onMonthChange={setMonth}
        chartCollapsed={chartCollapsed}
        onToggleChart={toggleChart}
        onEdit={editEntry}
        onDelete={deleteEntry}
      />
    </ModuleShell>
  );
}

interface PrimaryColumnProps {
  load: LoadState;
  year: number | null;
  onYearChange: (next: number | null) => void;
  month: number | null;
  onMonthChange: (next: number | null) => void;
  chartCollapsed: boolean;
  onToggleChart: () => void;
  onEdit: (entry: MoodEntry) => void;
  onDelete: (entry: MoodEntry) => void | Promise<void>;
}

function PrimaryColumn({
  load,
  year,
  onYearChange,
  month,
  onMonthChange,
  chartCollapsed,
  onToggleChart,
  onEdit,
  onDelete,
}: PrimaryColumnProps) {
  const { entries, availableYears } = useMoodData();
  const { filtered } = useMoodFilters();

  // Section heading describes the selected range plain-language so
  // a screen reader (and a glance) reads cleanly: "Entrées · En
  // cours", "Entrées · 2025 · mars", etc. Month is suppressed for
  // the rolling selection because the rolling window straddles
  // months by design.
  const yearLabel = year === null ? 'En cours' : String(year);
  const showMonth = year !== null && month !== null;

  return (
    <section className="flex min-w-0 flex-col">
      {/* Sticky upper region — the H1 + 30-day average + year picker
          + frise (with its legend) stay pinned flush against the
          topbar, with zero scroll-movement and no bleed-through.
          The `-mt-7 pt-7` pair pulls the wrapper's box up into the
          parent's `py-7` padding while keeping content at its
          original visual position; combined with `top-13` (the
          topbar's height) this means the wrapper's natural top
          already sits at the sticky threshold, so it pins the
          instant the user starts scrolling. The `bg-bg` then
          opaque-covers any entry scrolling underneath; `z-10`
          keeps it below the topbar (`z-20`). */}
      {/* Sticky upper region — H1 + year picker + frise (with its
          legend) + the « Entrées · … » section header all stay
          pinned flush against the topbar so the user always sees
          where they are while scrolling the entries list. */}
      <div className="sticky top-13 z-10 -mt-7 bg-bg pt-7 pb-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-3">
        <PageHeading className="mb-0">Mood</PageHeading>
        <YearSelector value={year} years={availableYears} onChange={onYearChange} />
      </div>

      {!chartCollapsed ? (
        <div className="mt-6">
          <Chart year={year} entries={entries} />
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h2 className="text-[12px] font-semibold tracking-[0.02em] text-muted">
          Entrées · {yearLabel}
          {showMonth ? ` · ${MONTH_LABELS_LONG[month]}` : ''}
        </h2>
        <div className="flex items-center gap-2">
          {year !== null ? (
            <MonthSelector value={month} onChange={onMonthChange} />
          ) : null}
          {/* Frise toggle — folds/unfolds the heatmap above. The
              chevron travels with the sticky pane so it stays
              accessible while the user scrolls the entries list. */}
          <button
            type="button"
            onClick={onToggleChart}
            aria-label={chartCollapsed ? 'Afficher la frise' : 'Masquer la frise'}
            title={chartCollapsed ? 'Afficher la frise' : 'Masquer la frise'}
            className="inline-flex h-5 w-5 shrink-0 cursor-pointer items-center justify-center rounded text-muted transition-colors hover:bg-bg-2 hover:text-ink"
          >
            <ChevronUpIcon
              className={cn(
                'h-3 w-3 transition-transform duration-200',
                chartCollapsed && 'rotate-180',
              )}
              aria-hidden="true"
            />
          </button>
        </div>
      </div>
      </div>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mt-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && entries.length === 0 ? (
          <EmptyHint>Chargement des entrées…</EmptyHint>
        ) : filtered.length === 0 ? (
          <EmptyHint>Aucune entrée pour cette période.</EmptyHint>
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
      className="grid gap-x-1 gap-y-[3px]"
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

      <HoverActions>
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          onClick={onEdit}
          aria-label="Modifier l’entrée"
          title="Modifier"
        >
          <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
        <Button
          variant="danger-ghost"
          size="sm"
          iconOnly
          onClick={onDelete}
          aria-label="Supprimer l’entrée"
          title="Supprimer"
        >
          <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Button>
      </HoverActions>
    </article>
  );
}

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
  // 30-day rolling mean — used to be displayed in the page subtitle;
  // now lives in the Patterns block as a permanent first row so the
  // header surface stays uncluttered.
  const avg30d = useMemo(() => computeAverage30d(entries), [entries]);

  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <section>
        <SectionLabel>Répartition</SectionLabel>
        <ScoreDonut entries={entries} />
      </section>

      <section>
        <SectionLabel>Patterns</SectionLabel>
        <ul>
          <li className="border-b border-hair py-2.5">
            <div className="text-[13px] font-medium text-ink">
              Moyenne mobile{' '}
              <span className="tabular-nums">{formatMoodAvg(avg30d)}</span>
            </div>
            <div className="mt-0.5 text-[11px] text-muted">
              sur 30 j · échelle −2 → +2
            </div>
          </li>
          {patterns.length === 0 ? (
            <li className="border-b border-hair py-2.5 last:border-b-0 text-[12px] italic text-muted">
              Pas encore assez d’entrées pour dégager des motifs.
            </li>
          ) : (
            patterns.map((p) => (
              <li key={p.label} className="border-b border-hair py-2.5 last:border-b-0">
                <div className="text-[13px] font-medium text-ink">{p.label}</div>
                <div className="mt-0.5 text-[11px] text-muted">{p.delta}</div>
              </li>
            ))
          )}
        </ul>
      </section>
    </aside>
  );
}

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
        aria-label={`Répartition des notes sur ${total} entrée${total === 1 ? '' : 's'}`}
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
