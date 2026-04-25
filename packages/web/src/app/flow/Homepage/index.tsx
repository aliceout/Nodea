import { useMemo, useState } from 'react';
import { Bars3Icon } from '@heroicons/react/24/outline';

import { useNodeaStore, selectUser } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Homepage — Direction K · Sauge.
 *
 * Pixel-precise port of `Design/design_handoff_nodea/source/dir-k.jsx
 * → K_Home`. Layout = topbar + 2-column body (1fr content + 280px
 * aside). All colours / sizes / animations come from the tokens
 * registered in `ui/theme/dirk.css`.
 *
 * The mobile sidebar drawer is opened from the topbar's hamburger
 * (preserves the existing `mobileMenuOpen` slice so nothing else
 * has to change).
 */
export default function HomePage() {
  const user = useNodeaStore(selectUser);
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const { t, language } = useI18n();

  const displayName = useMemo(() => preferredName(user), [user]);

  const formattedDate = useMemo(() => {
    const now = new Date();
    const localeTag = language === 'en' ? 'en-US' : 'fr-FR';
    const formatter = new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // "samedi 25 avril 2025 · jour 116"
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
    );
    return `${formatter.format(now)} · jour ${dayOfYear}`;
  }, [language]);

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        date={formattedDate}
        onOpenMenu={() => setMobileMenuOpen(true)}
        searchLabel={t('home.topbar.search', { defaultValue: 'Recherche' })}
        newEntryLabel={t('home.topbar.newEntry', { defaultValue: '+ Nouvelle entrée' })}
      />

      <div className="flex-1 overflow-hidden">
        <div className="grid h-full grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
          <PrimaryColumn name={displayName} />
          <SideColumn />
        </div>
      </div>
    </div>
  );
}

/** Display name preference: `username` if set, else email local-part. */
function preferredName(
  user: { username?: string | null; email?: string } | null | undefined,
): string {
  if (!user) return '';
  const trimmed = user.username?.trim();
  if (trimmed) return trimmed;
  const email = user.email;
  if (!email) return '';
  const [local] = email.split('@');
  return local ?? '';
}

interface TopbarProps {
  date: string;
  searchLabel: string;
  newEntryLabel: string;
  onOpenMenu: () => void;
}

function Topbar({ date, searchLabel, newEntryLabel, onOpenMenu }: TopbarProps) {
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
        <span className="text-[12px] tracking-[0.02em] text-muted">{date}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          className="hidden items-center gap-2 rounded-md border border-hair bg-bg px-3 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-accent hover:text-ink sm:inline-flex"
        >
          <kbd className="rounded border border-hair bg-bg-2 px-1 py-px font-mono text-[10px] text-muted">
            ⌘K
          </kbd>
          {searchLabel}
        </button>
        <button
          type="button"
          className="rounded-md bg-accent px-3.5 py-1.5 text-[12px] font-semibold text-white transition-[background-color,transform] duration-150 hover:bg-accent-deep active:translate-y-px"
        >
          {newEntryLabel}
        </button>
      </div>
    </div>
  );
}

interface PrimaryColumnProps {
  name: string;
}

function PrimaryColumn({ name }: PrimaryColumnProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        {name ? `Bonjour, ${name}.` : 'Bonjour.'}
      </h1>
      <p className="mt-1 mb-[22px] text-[14px] text-muted">Trois choses à voir aujourd&rsquo;hui.</p>

      <ToSeeList />
      <RecentMood />
      <RecentPassage />
    </section>
  );
}

interface TaskRow {
  label: string;
  meta: string;
  /** Time displayed on the right when the row is checked. */
  doneAt: string;
}

const TASKS: TaskRow[] = [
  { label: 'Mood du jour saisi', meta: 'note 7,8 · café, travail, marche', doneAt: '08:42' },
  { label: 'Lire 30 minutes', meta: 'Slow Productivity · p. 54 →', doneAt: '08:42' },
  { label: 'Marche du soir', meta: 'Habit · 12 jours d’affilée', doneAt: '08:42' },
];

function ToSeeList() {
  // First task pre-checked to mirror the design.
  const [checked, setChecked] = useState<Record<number, boolean>>({ 0: true });

  function toggle(index: number): void {
    setChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  return (
    <div>
      <SectionLabel>À voir</SectionLabel>
      <ul className="-mt-px">
        {TASKS.map((task, index) => {
          const isChecked = !!checked[index];
          return (
            <li
              key={task.label}
              className="animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5 last:border-b-0"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggle(index)}
                className={cn(
                  'flex h-4 w-4 shrink-0 translate-y-0.5 cursor-pointer items-center justify-center rounded-full border-[1.5px] transition-[border-color,background,transform] duration-200',
                  isChecked
                    ? 'border-accent bg-accent'
                    : 'border-muted-soft hover:scale-110 hover:border-accent',
                )}
              >
                {isChecked ? (
                  <svg width="9" height="9" viewBox="0 0 12 12" fill="none" aria-hidden="true">
                    <path
                      d="M2 6.5l3 3 5-7"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : null}
              </button>

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'text-[14.5px] font-medium transition-colors duration-200 group-hover:text-accent-deep',
                    isChecked ? 'text-muted line-through' : 'text-ink',
                  )}
                >
                  {task.label}
                </div>
                <div className="mt-0.5 text-[12.5px] text-muted">{task.meta}</div>
              </div>

              <span className="text-[11px] tabular-nums text-muted">
                {isChecked ? task.doneAt : '—'}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function RecentMood() {
  return (
    <div className="mt-7">
      <SectionLabel>Mood récent</SectionLabel>
      <div className="py-1.5">
        <p className="font-serif text-[17px] italic leading-[1.45] text-ink">
          «&nbsp;Café tranquille avec Sam, fin du chantier client, longue marche au bord du
          canal.&nbsp;»
        </p>
        <div className="mt-2 flex items-center gap-2.5 text-[12px] text-muted">
          <span className="font-semibold tabular-nums text-ink">7,8</span>
          <span>·</span>
          <span>Café · Travail · Marche</span>
          <span className="ml-auto">
            il y a 2 h ·{' '}
            <button
              type="button"
              className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
            >
              éditer
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}

function RecentPassage() {
  return (
    <div className="mt-7">
      <SectionLabel>Passage récent</SectionLabel>
      <div className="py-1.5">
        <p className="font-serif text-[16px] leading-[1.5] text-ink">
          «&nbsp;Le jour où j&rsquo;ai compris que la lenteur n&rsquo;était pas un défaut.&nbsp;»
        </p>
        <p className="mt-1.5 text-[12px] text-muted">
          Slow Productivity, Cal Newport · p. 64 ·{' '}
          <button
            type="button"
            className="cursor-pointer text-accent transition-colors hover:text-accent-deep hover:underline"
          >
            voir tous les passages
          </button>
        </p>
      </div>
    </div>
  );
}

function SideColumn() {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <HabitsBlock />
      <IntentionsBlock />
      <ReadingBlock />
    </aside>
  );
}

function HabitsBlock() {
  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Habits</SectionLabel>
        <span className="animate-streak-pulse text-[12px] font-semibold tabular-nums text-accent">
          12 j
        </span>
      </div>
      <div className="grid grid-cols-[repeat(15,minmax(0,1fr))] gap-[3px]">
        {Array.from({ length: 60 }).map((_, i) => {
          const v = (Math.sin(i * 1.7) + 1) / 2;
          const cls =
            v > 0.7
              ? 'bg-accent'
              : v > 0.45
                ? 'bg-accent-soft'
                : v > 0.2
                  ? 'bg-bg-2'
                  : 'bg-hair';
          return (
            <span
              key={i}
              aria-hidden="true"
              className={cn('animate-cell-pop aspect-square rounded-sm', cls)}
              style={{ animationDelay: `${i * 6}ms` }}
            />
          );
        })}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>78 % ce mois</span>
        <span className="font-semibold text-sync">+6 % vs mars</span>
      </div>
    </section>
  );
}

interface Intention {
  title: string;
  pct: number;
}

const INTENTIONS: Intention[] = [
  { title: 'Écrire 3× / semaine', pct: 62 },
  { title: 'Lire 24 livres', pct: 45 },
  { title: 'Marcher 8 km / jour', pct: 78 },
];

function IntentionsBlock() {
  return (
    <section>
      <SectionLabel>Intentions</SectionLabel>
      {INTENTIONS.map((g, i) => (
        <div key={g.title} className="mb-[7px]">
          <div className="mb-[3px] flex justify-between text-[12.5px] text-ink">
            <span>{g.title}</span>
            <span className="text-[11px] tabular-nums text-muted">{g.pct}%</span>
          </div>
          <div className="h-[3px] overflow-hidden rounded-sm bg-hair">
            <div
              className="animate-bar-fill h-full rounded-sm bg-accent"
              style={{ width: `${g.pct}%`, animationDelay: `${200 + i * 120}ms` }}
            />
          </div>
        </div>
      ))}
    </section>
  );
}

interface Reading {
  title: string;
  author: string;
  page: string;
}

const READINGS: Reading[] = [
  { title: 'Le Pavillon d’Or', author: 'Mishima', page: '64 / 248' },
  { title: 'Slow Productivity', author: 'Cal Newport', page: '54 / 244' },
];

function ReadingBlock() {
  return (
    <section>
      <SectionLabel>En cours de lecture</SectionLabel>
      <ul>
        {READINGS.map((b) => (
          <li
            key={b.title}
            className="flex items-baseline justify-between border-b border-hair py-[5px] last:border-b-0"
          >
            <div>
              <div className="text-[13px] font-medium text-ink">{b.title}</div>
              <div className="text-[11px] text-muted">{b.author}</div>
            </div>
            <span className="text-[11px] tabular-nums text-muted">{b.page}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-1.5 text-[12px] font-semibold tracking-[0.02em] text-muted">{children}</div>
  );
}
