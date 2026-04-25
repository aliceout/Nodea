import { useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

/**
 * Mood — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k-extras.jsx
 * → K_Mood`. Single detail view (no more tabs) with a 30-day bar
 * chart, an entries list, a tag filter rail and a Patterns block.
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
        <div className="grid h-full grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_320px]">
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
  note: number;
  quote: string;
  tags: string;
}

const ENTRIES: MoodEntry[] = [
  {
    date: 'Aujourd’hui',
    note: 7.8,
    quote: 'Café tranquille avec Sam, fin du chantier client, longue marche au bord du canal.',
    tags: 'café · travail · marche',
  },
  {
    date: 'Hier',
    note: 6.2,
    quote: 'Mauvais sommeil, tête lourde toute la matinée. Mieux après la pluie.',
    tags: 'fatigue · pluie · lecture',
  },
  {
    date: 'Mardi 22 avril',
    note: 8.4,
    quote: 'Anniversaire de Léa, dîner long. Riz brûlé, fou rire.',
    tags: 'famille · soir',
  },
  {
    date: 'Lundi 21 avril',
    note: 5.9,
    quote: 'Reprise difficile. Trop de Slack, pas assez d’air.',
    tags: 'travail · saturé',
  },
  {
    date: 'Dimanche 20 avril',
    note: 8.1,
    quote: 'Marché au matin, sieste, livre commencé puis abandonné.',
    tags: 'repos · marché',
  },
  {
    date: 'Samedi 19 avril',
    note: 7.0,
    quote: 'Course longue dans le bois. Genou un peu raide.',
    tags: 'sport · bois',
  },
  {
    date: 'Vendredi 18 avril',
    note: 6.5,
    quote: 'Dîner annulé, finalement préféré rester chez moi.',
    tags: 'solo · cuisine',
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
        <span className="font-semibold text-ink">7,2</span> sur 30 j
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

function Chart() {
  return (
    <div
      aria-hidden="true"
      className="mb-7 grid h-[60px] grid-cols-[repeat(30,minmax(0,1fr))] items-end gap-1"
    >
      {Array.from({ length: 30 }).map((_, i) => {
        const v = 4 + (Math.sin(i * 0.6) + 1) * 2.5;
        const heightPct = (v / 10) * 100;
        const isToday = i === 29;
        return (
          <span
            key={i}
            className={cn(
              'rounded-sm transition-colors',
              isToday ? 'bg-accent' : 'bg-accent-soft',
            )}
            style={{ height: `${heightPct}%` }}
          />
        );
      })}
    </div>
  );
}

function EntryRow({ entry }: { entry: MoodEntry }) {
  const noteColor =
    entry.note >= 7 ? 'text-accent-deep' : entry.note >= 6 ? 'text-ink-soft' : 'text-muted';
  return (
    <div className="grid grid-cols-[110px_36px_1fr] items-baseline gap-4 border-b border-hair py-3.5">
      <div className="text-[12px] tabular-nums text-muted">{entry.date}</div>
      <div className={cn('text-[13px] font-bold tabular-nums', noteColor)}>
        {entry.note.toString().replace('.', ',')}
      </div>
      <div>
        <div className="font-serif text-[15px] italic leading-[1.45] text-ink">
          «&nbsp;{entry.quote}&nbsp;»
        </div>
        <div className="mt-1 text-[11px] text-muted">{entry.tags}</div>
      </div>
    </div>
  );
}

const FILTER_TAGS = [
  'café',
  'travail',
  'marche',
  'famille',
  'soir',
  'repos',
  'sport',
  'bois',
  'cuisine',
  'fatigue',
];

interface Pattern {
  label: string;
  delta: string;
}

const PATTERNS: Pattern[] = [
  { label: 'Tu es plus heureuse les samedis', delta: '+1,4 vs moyenne' },
  { label: 'Café & marche corrèlent', delta: 'r = 0,42' },
  { label: 'Lundi est ton point bas', delta: '−1,1 vs moyenne' },
];

function SideColumn() {
  const [activeTag, setActiveTag] = useState<string | null>('café');

  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <section>
        <SectionLabel>Filtres</SectionLabel>
        <div className="-mb-1.5 flex flex-wrap">
          {FILTER_TAGS.map((tag) => {
            const active = activeTag === tag;
            return (
              <button
                key={tag}
                type="button"
                onClick={() => setActiveTag(active ? null : tag)}
                className={cn(
                  'mr-1 mb-1.5 cursor-pointer rounded-full px-2.5 py-1 text-[12px] transition-colors',
                  active ? 'bg-accent text-white' : 'bg-bg-2 text-ink-soft hover:text-ink',
                )}
              >
                {tag}
              </button>
            );
          })}
        </div>
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

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}
