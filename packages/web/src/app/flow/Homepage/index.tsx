import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Bars3Icon } from '@heroicons/react/24/outline';
import { MOOD_SCORE_VALUES, type MoodScore } from '@nodea/shared';

import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import EmptyHomepage from './Empty';

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
  const openComposer = useNodeaStore((s) => s.openComposer);
  const { t, language } = useI18n();
  const [searchParams] = useSearchParams();

  // Until real entry-count data is wired through TanStack Query,
  // `?empty=1` flips the page to its first-day variant so the design
  // can be reviewed without faking store state. The condition will
  // expand once the home dashboard reads from real collections.
  const forceEmpty = searchParams.get('empty') === '1';

  const displayName = useMemo(() => preferredName(user), [user]);
  const moodEntries = useMoodEntries();

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

  if (forceEmpty) return <EmptyHomepage />;

  return (
    <div className="animate-fade-up flex min-w-0 flex-1 flex-col">
      <Topbar
        date={formattedDate}
        onOpenMenu={() => setMobileMenuOpen(true)}
        onOpenComposer={() => openComposer()}
        searchLabel={t('home.topbar.search', { defaultValue: 'Recherche' })}
        newEntryLabel={t('home.topbar.newEntry', { defaultValue: '+ Nouvelle entrée' })}
      />

      <div className="grid grid-cols-1 gap-9 px-6 py-7 sm:px-9 lg:grid-cols-[1fr_280px]">
        <PrimaryColumn name={displayName} moodEntries={moodEntries} />
        <SideColumn moodEntries={moodEntries} />
      </div>
    </div>
  );
}

/**
 * Lite shape of a Mood entry consumed by the Home blocks (`MoodBlock`,
 * `ToSeeList`). Stays in this file so the heavier `recordToEntry`
 * inside `Mood/index.tsx` can keep its richer shape (positives,
 * comments, formatted labels) without leaking into Home.
 */
interface MoodEntryLite {
  dateIso: string;
  score: MoodScore;
  /** ISO timestamp from the server — used by `ToSeeList` to display
   *  `HH:MM` next to a checked Mood task. */
  createdAt: string;
}

const MOOD_VALID_SCORES: ReadonlySet<string> = new Set(MOOD_SCORE_VALUES);

/**
 * One-shot fetch + projection of the user's Mood entries. Re-runs
 * whenever `moodVersion` is bumped (the Composer's MoodBody
 * increments it after a successful create), so newly saved entries
 * appear on Home without a page reload. Failures are silenced — the
 * Mood page surfaces the real error.
 */
function useMoodEntries(): MoodEntryLite[] {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['mood']?.moduleUserId ?? null;
  const moodVersion = useNodeaStore((s) => s.moodVersion);

  const [entries, setEntries] = useState<MoodEntryLite[]>([]);

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    moodClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const lite: MoodEntryLite[] = [];
        for (const r of records) {
          const p = r.payload;
          const dateIso =
            p.date && /^\d{4}-\d{2}-\d{2}/.test(p.date)
              ? p.date.slice(0, 10)
              : r.createdAt.slice(0, 10);
          if (!MOOD_VALID_SCORES.has(p.mood_score)) continue;
          lite.push({
            dateIso,
            score: p.mood_score as MoodScore,
            createdAt: r.createdAt,
          });
        }
        setEntries(lite);
      })
      .catch(() => {
        // Silent on Home — the Mood page surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, moodVersion]);

  return entries;
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
  onOpenComposer: () => void;
}

function Topbar({
  date,
  searchLabel,
  newEntryLabel,
  onOpenMenu,
  onOpenComposer,
}: TopbarProps) {
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
        <span className="text-[12px] tracking-[0.02em] text-muted">{date}</span>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpenComposer}
          className="hidden items-center gap-2 rounded-md border border-hair bg-bg px-3 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-accent hover:text-ink sm:inline-flex"
        >
          <kbd className="rounded border border-hair bg-bg-2 px-1 py-px font-mono text-[10px] text-muted">
            ⌘K
          </kbd>
          {searchLabel}
        </button>
        <button
          type="button"
          onClick={onOpenComposer}
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
  moodEntries: ReadonlyArray<MoodEntryLite>;
}

function PrimaryColumn({ name, moodEntries }: PrimaryColumnProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.025em] text-ink">
        {name ? `Bonjour, ${name}.` : 'Bonjour.'}
      </h1>
      <p className="mt-1 mb-[22px] text-[14px] text-muted">Trois choses à voir aujourd&rsquo;hui.</p>

      <ToSeeList moodEntries={moodEntries} />
      <RecentMood />
      <RecentPassage />
    </section>
  );
}

interface MockTask {
  label: string;
  meta: string;
  doneAt: string;
}

/** Other "À voir" tasks. Still mocked while Library + Habits aren't
 *  wired through — clicking the checkbox toggles the local state.
 *  When the matching modules go live, swap them for real signals
 *  the same way the Mood task already is. */
const MOCK_TASKS: ReadonlyArray<MockTask> = [
  { label: 'Lire 30 minutes', meta: 'Slow Productivity · p. 54 →', doneAt: '08:42' },
  { label: 'Marche du soir', meta: 'Habit · 12 jours d’affilée', doneAt: '08:42' },
];

interface ToSeeListProps {
  moodEntries: ReadonlyArray<MoodEntryLite>;
}

function ToSeeList({ moodEntries }: ToSeeListProps) {
  const openComposer = useNodeaStore((s) => s.openComposer);

  // Today's mood entry, if any. Derived from the lifted Home hook so
  // the same fetch powers the side-column MoodBlock.
  const todayMood = useMemo(() => {
    const todayIso = toIsoDate(new Date());
    return moodEntries.find((e) => e.dateIso === todayIso) ?? null;
  }, [moodEntries]);

  // Mock tasks keep a small toggle so the design still demos
  // interactivity. Mood task is derived, not toggled.
  const [mockChecked, setMockChecked] = useState<Record<number, boolean>>({});
  function toggleMock(index: number): void {
    setMockChecked((prev) => ({ ...prev, [index]: !prev[index] }));
  }

  const moodMeta = todayMood
    ? `note ${signedScore(todayMood.score)}`
    : 'Pas encore saisi aujourd’hui';

  return (
    <div>
      <SectionLabel>À voir</SectionLabel>
      <ul className="-mt-px">
        {/* Mood task — dynamic */}
        <li
          className="animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5"
          style={{ animationDelay: '0ms' }}
        >
          <span
            role="img"
            aria-label={todayMood ? 'Mood saisi' : 'Mood pas encore saisi'}
            className={cn(
              'flex h-4 w-4 shrink-0 translate-y-0.5 items-center justify-center rounded-full border-[1.5px] transition-colors duration-200',
              todayMood ? 'border-accent bg-accent' : 'border-muted-soft',
            )}
          >
            {todayMood ? (
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
          </span>

          <div className="min-w-0 flex-1">
            <div
              className={cn(
                'text-[14.5px] font-medium transition-colors duration-200',
                todayMood ? 'text-muted line-through' : 'text-ink',
              )}
            >
              Mood du jour saisi
            </div>
            <div className="mt-0.5 text-[12.5px] text-muted">{moodMeta}</div>
          </div>

          {todayMood ? (
            <span className="text-[11px] tabular-nums text-muted">
              {formatTimeFromIso(todayMood.createdAt)}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => openComposer('mood')}
              className="cursor-pointer rounded-md border border-hair bg-bg px-2 py-1 text-[11px] font-medium text-ink-soft transition-colors hover:border-accent hover:text-ink"
            >
              + Saisir
            </button>
          )}
        </li>

        {/* Mock tasks (Library + Habits not wired yet) */}
        {MOCK_TASKS.map((task, index) => {
          const isChecked = !!mockChecked[index];
          return (
            <li
              key={task.label}
              className="animate-slide-in group flex items-baseline gap-3 border-b border-hair py-2.5 last:border-b-0"
              style={{ animationDelay: `${(index + 1) * 80}ms` }}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={isChecked}
                onClick={() => toggleMock(index)}
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

function signedScore(s: MoodScore): string {
  return Number(s) > 0 ? `+${s}` : s;
}

function formatTimeFromIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
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

interface SideColumnProps {
  moodEntries: ReadonlyArray<MoodEntryLite>;
}

function SideColumn({ moodEntries }: SideColumnProps) {
  return (
    <aside className="flex min-w-0 flex-col gap-6">
      <MoodBlock entries={moodEntries} />
      <HabitsBlock />
      <IntentionsBlock />
      <ReadingBlock />
    </aside>
  );
}

const MOOD_FRISE_DAYS = 14;

/**
 * Same colour ramp as the Mood page's `SCORE_FILL` (kept duplicated
 * because the Mood page doesn't export it). Update both if the
 * tones drift — see `packages/web/src/app/flow/Mood/index.tsx`.
 */
const MOOD_BLOCK_FILL: Record<MoodScore, string> = {
  '2': 'bg-accent',
  '1': 'bg-accent-soft',
  '0': 'bg-hair',
  '-1': 'bg-low-soft',
  '-2': 'bg-low',
};

interface MoodFriseCell {
  dateIso: string;
  score?: MoodScore;
  isToday: boolean;
}

/**
 * 14-day mood strip on Home. Reads from the lifted `useMoodEntries`
 * hook on the Home parent — the same fetch powers `ToSeeList`'s
 * dynamic Mood task. Days without an entry render as a faint
 * outline so gaps stay visible without faking a zero.
 *
 * Smaller-by-design than the Mood page's 52-week frise — this is
 * a glance, not a chart. Click-through could land on `/flow/mood`
 * later if we want a navigable version.
 */
function MoodBlock({ entries }: { entries: ReadonlyArray<MoodEntryLite> }) {
  const cells = useMemo<MoodFriseCell[]>(() => {
    const byDate = new Map<string, MoodScore>();
    for (const e of entries) byDate.set(e.dateIso, e.score);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const out: MoodFriseCell[] = [];
    for (let i = MOOD_FRISE_DAYS - 1; i >= 0; i -= 1) {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      const iso = toIsoDate(d);
      const score = byDate.get(iso);
      const cell: MoodFriseCell = { dateIso: iso, isToday: i === 0 };
      if (score) cell.score = score;
      out.push(cell);
    }
    return out;
  }, [entries]);

  const stats = useMemo(() => {
    const scored = cells.filter((c): c is MoodFriseCell & { score: MoodScore } => !!c.score);
    if (scored.length === 0) return { count: 0, avg: null as number | null };
    const sum = scored.reduce((s, c) => s + Number(c.score), 0);
    return { count: scored.length, avg: sum / scored.length };
  }, [cells]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Mood</SectionLabel>
        {stats.avg !== null ? (
          <span className="text-[12px] font-semibold tabular-nums text-accent">
            {formatMoodAvg(stats.avg)}
          </span>
        ) : null}
      </div>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: `repeat(${MOOD_FRISE_DAYS}, minmax(0, 1fr))` }}
        aria-hidden="true"
      >
        {cells.map((c) =>
          c.score ? (
            <span
              key={c.dateIso}
              title={`${c.dateIso} · ${c.score}`}
              className={cn(
                'aspect-square rounded-[2px]',
                MOOD_BLOCK_FILL[c.score],
                c.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
              )}
            />
          ) : (
            <span
              key={c.dateIso}
              className={cn(
                'aspect-square rounded-[2px] border border-hair/70',
                c.isToday && 'ring-2 ring-accent ring-offset-1 ring-offset-bg',
              )}
            />
          ),
        )}
      </div>
      <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted">
        <span>
          {stats.count} {stats.count === 1 ? 'entrée' : 'entrées'} · {MOOD_FRISE_DAYS} j
        </span>
        {stats.avg !== null ? <span>moyenne {formatMoodAvg(stats.avg)}</span> : null}
      </div>
    </section>
  );
}

function toIsoDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatMoodAvg(avg: number): string {
  const sign = avg > 0 ? '+' : avg < 0 ? '−' : '';
  const abs = Math.abs(avg).toFixed(1).replace('.', ',');
  return `${sign}${abs}`;
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
