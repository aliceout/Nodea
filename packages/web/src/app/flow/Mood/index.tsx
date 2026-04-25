import { Bars3Icon } from '@heroicons/react/24/outline';
import { type MoodScore } from '@nodea/shared';

import { useNodeaStore } from '@/core/store/nodea-store';
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
export default function MoodPage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        onOpenMenu={() => setMobileMenuOpen(true)}
        onNewEntry={() => openComposer('mood')}
      />

      <div className="flex-1 overflow-hidden">
        <div className="min-h-0 grid h-full grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
          <PrimaryColumn />
          <SideColumn />
        </div>
      </div>
    </div>
  );
}

interface TopbarProps {
  onOpenMenu: () => void;
  onNewEntry: () => void;
}

function Topbar({ onOpenMenu, onNewEntry }: TopbarProps) {
  return (
    <div className="flex h-[52px] items-center justify-between border-b border-hair px-6 sm:px-9">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenMenu}
          aria-label="Ouvrir le menu"
          className="-ml-2 inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-soft transition-colors hover:bg-bg-2 hover:text-ink lg:hidden"
        >
          <Bars3Icon className="h-5 w-5" aria-hidden="true" />
        </button>
        <span className="text-[12px] tracking-[0.02em] text-muted">Mood · 116 entrées</span>
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
  date: string;
  score: MoodScore;
  positives: [string, string, string];
  comment?: string;
  question?: string;
  answer?: string;
}

const ENTRIES: MoodEntry[] = [
  {
    date: 'Aujourd’hui',
    score: '2',
    positives: [
      'Café tranquille avec Sam au matin.',
      'Fin du chantier client envoyée, soulagement.',
      'Longue marche au bord du canal.',
    ],
    question: 'Quelle petite victoire peux-tu célébrer ?',
    answer: 'Avoir tenu une vraie pause sans ouvrir Slack.',
  },
  {
    date: 'Hier',
    score: '-1',
    positives: [
      'Réveil un peu plus doux que prévu.',
      'Un message d’Élise qui faisait plaisir.',
      '',
    ],
    comment: 'Mauvais sommeil, tête lourde toute la matinée. Mieux après la pluie.',
  },
  {
    date: 'Mardi 22 avril',
    score: '2',
    positives: [
      'Anniversaire de Léa.',
      'Dîner long avec rires multiples.',
      'Riz brûlé, fou rire derrière.',
    ],
  },
  {
    date: 'Lundi 21 avril',
    score: '-1',
    positives: [
      'Réussi à finir les notes du week-end.',
      '',
      '',
    ],
    comment: 'Reprise difficile. Trop de Slack, pas assez d’air.',
  },
  {
    date: 'Dimanche 20 avril',
    score: '1',
    positives: [
      'Marché au matin, très calme.',
      'Sieste posée.',
      'Livre commencé puis abandonné, mais pas grave.',
    ],
  },
  {
    date: 'Samedi 19 avril',
    score: '1',
    positives: [
      'Course longue dans le bois.',
      'Découverte d’un sentier nouveau.',
      'Genou un peu raide mais ça tient.',
    ],
  },
  {
    date: 'Vendredi 18 avril',
    score: '0',
    positives: [
      'Dîner annulé, finalement préféré rester chez moi.',
      'Soirée lecture.',
      '',
    ],
  },
];

function PrimaryColumn() {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        Mood
      </h1>
      <p className="mt-1 mb-6 text-[14px] text-muted">
        116 entrées · moyenne mobile{' '}
        <span className="font-semibold text-ink">+0,8</span> sur 30 j (échelle −2 → +2)
      </p>

      <Chart />

      <div className="min-h-0 flex-1 overflow-auto pr-1">
        {ENTRIES.map((entry) => (
          <EntryRow key={entry.date} entry={entry} />
        ))}
      </div>
    </section>
  );
}

/**
 * 30-day note sparkline. SVG line + dots over a faint zero baseline,
 * mapping the −2..+2 scale to vertical position. Reads at a glance
 * far better than centered bars on a 4-step axis: today's dot
 * stays brighter, points above zero pick up the accent, points
 * below the zero line stay muted.
 */
function Chart() {
  // Mock: 30 days of -2..+2 notes, sinusoidal with a slight bias toward positives.
  const series = Array.from({ length: 30 }, (_, i) => {
    const raw = Math.sin(i * 0.6) * 1.4 + 0.4;
    return Math.max(-2, Math.min(2, Math.round(raw)));
  });

  const W = 300;
  const H = 72;
  const padY = 10;
  const innerH = H - padY * 2;
  const stepX = W / series.length;
  const yFor = (score: number): number =>
    padY + (1 - (score + 2) / 4) * innerH;
  const points = series.map((score, i) => ({
    x: (i + 0.5) * stepX,
    y: yFor(score),
    score,
    isToday: i === series.length - 1,
  }));
  const zeroY = yFor(0);

  return (
    <div className="mb-7 h-[72px] w-full" aria-hidden="true">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        className="h-full w-full overflow-visible"
        role="img"
      >
        <line
          x1={0}
          y1={zeroY}
          x2={W}
          y2={zeroY}
          className="stroke-hair"
          strokeWidth={1}
          strokeDasharray="2 4"
          vectorEffect="non-scaling-stroke"
        />
        <polyline
          points={points.map((p) => `${p.x},${p.y}`).join(' ')}
          fill="none"
          className="stroke-accent-soft"
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />
        {points.map((p, i) => {
          const cls = p.isToday
            ? 'fill-accent'
            : p.score > 0
              ? 'fill-accent-soft'
              : p.score < 0
                ? 'fill-ink-soft'
                : 'fill-muted-soft';
          return (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={p.isToday ? 3 : 2}
              className={cls}
              vectorEffect="non-scaling-stroke"
            />
          );
        })}
      </svg>
    </div>
  );
}

function EntryRow({ entry }: { entry: MoodEntry }) {
  return (
    <article className="grid grid-cols-[110px_44px_1fr] items-baseline gap-4 border-b border-hair py-4">
      <div className="text-[12px] tabular-nums text-muted">{entry.date}</div>
      <NoteBadge score={entry.score} />
      <div className="min-w-0">
        <ul className="space-y-0.5">
          {entry.positives
            .filter((p) => p.trim().length > 0)
            .map((p, i) => (
              <li
                key={i}
                className="flex items-baseline gap-2 text-[14px] leading-[1.5] text-ink"
              >
                <span aria-hidden="true" className="mt-0.5 text-[10px] text-muted">
                  ·
                </span>
                <span>{p}</span>
              </li>
            ))}
        </ul>
        {entry.comment ? (
          <p className="mt-1.5 text-[13px] italic leading-[1.5] text-ink-soft">
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
    </article>
  );
}

const SCORE_TONE: Record<MoodScore, string> = {
  '2': 'bg-accent text-white',
  '1': 'bg-accent-soft text-accent-deep',
  '0': 'bg-bg-2 text-ink-soft',
  '-1': 'bg-hair text-ink-soft',
  '-2': 'bg-ink text-bg',
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
 * Patterns shown in the side column — every entry here must be
 * derivable from `{date, score, positives[3], comment, question,
 * answer}` alone. No external signals (sleep, calendar, weather…)
 * because the app doesn't capture them; surfacing fake correlations
 * undermines trust.
 */
const PATTERNS: Pattern[] = [
  { label: 'Samedi est ton meilleur jour', delta: '+0,9 vs moyenne' },
  { label: 'Lundi reste ton point bas', delta: '−0,7 vs moyenne' },
  { label: '12 jours consécutifs ≥ 0', delta: 'meilleur streak du mois' },
];

function SideColumn() {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel>Distribution</SectionLabel>
        <ScoreDistribution />
      </section>

      <section>
        <SectionLabel>Patterns</SectionLabel>
        <ul>
          {PATTERNS.map((p) => (
            <li key={p.label} className="border-b border-hair py-2.5 last:border-b-0">
              <div className="text-[13px] font-medium text-ink">{p.label}</div>
              <div className="mt-0.5 text-[11px] text-muted">{p.delta}</div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

/**
 * Stacked bar of how the last 30 entries split across the five
 * note buckets. Mocked while the entries collection isn't wired —
 * shape is intentionally trivial so it costs nothing to swap to a
 * real selector later.
 */
function ScoreDistribution() {
  const counts: Record<MoodScore, number> = {
    '2': 9,
    '1': 11,
    '0': 5,
    '-1': 3,
    '-2': 2,
  };
  const total = 30;
  const order: MoodScore[] = ['2', '1', '0', '-1', '-2'];

  return (
    <ul className="space-y-2">
      {order.map((score) => {
        const count = counts[score];
        const pct = (count / total) * 100;
        return (
          <li key={score} className="flex items-center gap-3 text-[12px]">
            <NoteBadge score={score} />
            <div className="h-[6px] flex-1 overflow-hidden rounded-sm bg-bg-2">
              <div
                className={cn(
                  'h-full rounded-sm',
                  Number(score) > 0 ? 'bg-accent' : Number(score) < 0 ? 'bg-ink-soft' : 'bg-muted-soft',
                )}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right tabular-nums text-muted">{count}</span>
          </li>
        );
      })}
    </ul>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}
