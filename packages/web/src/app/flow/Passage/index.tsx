import { Bars3Icon } from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';

/**
 * Passages — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k-extras.jsx
 * → K_Passages`. Single scrollable column grouped by book, with the
 * book title in sans, the author in serif italic, and each passage
 * as a `p. NN | citation | il y a Xj` row in the K serif body face.
 *
 * Data is mocked while the redesign settles — wiring to the
 * encrypted `passage_entries` collection happens in a follow-up
 * commit once the UI shape is locked.
 */
export default function PassagePage() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar onOpenMenu={() => setMobileMenuOpen(true)} />

      <div className="flex-1 overflow-auto px-6 py-7 sm:px-9">
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
          Passages
        </h1>
        <p className="mt-1 mb-8 text-[14px] text-muted">Ce qui mérite d&rsquo;être relu.</p>

        {GROUPS.map((group) => (
          <BookGroup key={group.book} group={group} />
        ))}
      </div>
    </div>
  );
}

interface TopbarProps {
  onOpenMenu: () => void;
}

function Topbar({ onOpenMenu }: TopbarProps) {
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
        <span className="text-[12px] tracking-[0.02em] text-muted">
          Passages · 42 extraits · 9 livres
        </span>
      </div>

      <button
        type="button"
        className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
      >
        + Nouveau passage
      </button>
    </div>
  );
}

interface PassageRow {
  page: number;
  quote: string;
  ago: string;
}

interface BookGroupData {
  book: string;
  author: string;
  year: number;
  count: number;
  passages: PassageRow[];
}

const GROUPS: BookGroupData[] = [
  {
    book: 'Slow Productivity',
    author: 'Cal Newport',
    year: 2024,
    count: 8,
    passages: [
      {
        page: 64,
        quote: 'Le jour où j’ai compris que la lenteur n’était pas un défaut.',
        ago: 'il y a 2 j',
      },
      {
        page: 41,
        quote: 'Faire moins de choses, mieux. La discipline du retrait.',
        ago: 'il y a 4 j',
      },
      {
        page: 22,
        quote: 'Le travail profond n’est pas un luxe, c’est une condition.',
        ago: 'il y a 1 sem.',
      },
    ],
  },
  {
    book: 'Le Pavillon d’Or',
    author: 'Yukio Mishima',
    year: 1956,
    count: 5,
    passages: [
      {
        page: 188,
        quote: 'La beauté indifférente est plus cruelle que la laideur.',
        ago: 'il y a 1 j',
      },
      {
        page: 92,
        quote: 'Je voulais qu’il brûle pour cesser de me rendre faible.',
        ago: 'il y a 5 j',
      },
    ],
  },
  {
    book: 'Bouvard et Pécuchet',
    author: 'Flaubert',
    year: 1881,
    count: 3,
    passages: [
      {
        page: 210,
        quote:
          'Ils ne pouvaient s’empêcher d’apprendre, ni de tout désapprendre aussitôt.',
        ago: 'il y a 2 sem.',
      },
    ],
  },
];

function BookGroup({ group }: { group: BookGroupData }) {
  return (
    <div className="mb-9">
      <div className="mb-3.5 flex items-baseline gap-3 border-b border-hair pb-2">
        <h2 className="text-[18px] font-semibold tracking-[-0.015em] text-ink">{group.book}</h2>
        <span className="font-serif text-[13px] italic text-ink-soft">{group.author}</span>
        <span className="text-[12px] tabular-nums text-muted">{group.year}</span>
        <span className="ml-auto text-[11px] text-muted">
          {group.count} passages ·{' '}
          <button
            type="button"
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            tout voir
          </button>
        </span>
      </div>

      <ul>
        {group.passages.map((p) => (
          <li
            key={p.page}
            className="grid grid-cols-[40px_1fr_90px] items-baseline gap-4 border-b border-hair py-3.5 last:border-b-0"
          >
            <div className="text-right text-[12px] tabular-nums text-muted">p. {p.page}</div>
            <div className="font-serif text-[17px] leading-[1.5] text-ink">
              «&nbsp;{p.quote}&nbsp;»
            </div>
            <div className="text-right text-[11px] text-muted">{p.ago}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}
