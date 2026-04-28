import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  GOAL_STATUS_VALUES,
  MOOD_SCORE_VALUES,
  type GoalsPayload,
  type MoodScore,
} from '@nodea/shared';

import { goalsClient } from '@/core/api/modules/goals';
import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';
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
  const goalEntries = useGoalEntries();

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
    <ModuleShell
      topbar={
        <Topbar
          label={formattedDate}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <button
            type="button"
            onClick={() => openComposer()}
            className="hidden items-center gap-2 rounded-md border border-hair bg-bg px-3 py-1.5 text-[12px] text-ink-soft transition-colors hover:border-accent hover:text-ink sm:inline-flex"
          >
            <kbd className="rounded border border-hair bg-bg-2 px-1 py-px font-mono text-[10px] text-muted">
              ⌘K
            </kbd>
            {t('home.topbar.search', { defaultValue: 'Recherche' })}
          </button>
          <Button variant="primary" size="sm" onClick={() => openComposer()}>
            {t('home.topbar.newEntry', { defaultValue: '+ Nouvelle entrée' })}
          </Button>
        </Topbar>
      }
      side={<SideColumn moodEntries={moodEntries} goalEntries={goalEntries} />}
    >
      <PrimaryColumn name={displayName} moodEntries={moodEntries} />
    </ModuleShell>
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
        // Server-side timestamps are gone (minimum-readable-surface
        // design). The user-facing `payload.date` carries the only
        // date we have ; if it's missing we drop the entry rather
        // than guess. The `createdAt` lite field — used for tie-
        // breaking when several entries share a date — falls back
        // to `dateIso` so the home block still renders something
        // meaningful.
        const lite: MoodEntryLite[] = [];
        for (const r of records) {
          const p = r.payload;
          if (!p.date || !/^\d{4}-\d{2}-\d{2}/.test(p.date)) continue;
          if (!MOOD_VALID_SCORES.has(p.mood_score)) continue;
          const dateIso = p.date.slice(0, 10);
          lite.push({
            dateIso,
            score: p.mood_score as MoodScore,
            createdAt: dateIso,
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

type GoalStatusLite = 'open' | 'wip' | 'done';

interface GoalEntryLite {
  id: string;
  title: string;
  status: GoalStatusLite;
  thread: string;
  /** ISO `updatedAt` from the record — used to keep recent
   *  goals on top when there's no other ordering signal. */
  updatedAt: string;
}

const GOAL_VALID_STATUS: ReadonlySet<string> = new Set(GOAL_STATUS_VALUES);

/**
 * One-shot fetch + projection of the user's Goals. Re-runs
 * whenever `goalsVersion` is bumped (the Composer's GoalBody and
 * the Goals page's status toggles increment it after every
 * mutation), so newly saved goals appear on Home without a page
 * reload. Failures stay silent — the Goals page surfaces the
 * real error.
 *
 * Lite shape on purpose : only what the SideColumn block reads.
 * The full `GoalEntry` (date / note / completedAt) lives in the
 * Goals page and doesn't need to leak into Home.
 */
function useGoalEntries(): GoalEntryLite[] {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['goals']?.moduleUserId ?? null;
  const goalsVersion = useNodeaStore((s) => s.goalsVersion);

  const [entries, setEntries] = useState<GoalEntryLite[]>([]);

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    goalsClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        const lite: GoalEntryLite[] = [];
        for (const r of records) {
          const p = r.payload as GoalsPayload;
          const title = p.title?.trim() ?? '';
          if (!title) continue;
          const raw = (p.status ?? 'open') as string;
          if (!GOAL_VALID_STATUS.has(raw)) continue;
          // Map legacy aliases the same way the Goals page does
          // so the home block doesn't render a fourth tone.
          const status: GoalStatusLite =
            raw === 'active'
              ? 'open'
              : raw === 'archived'
                ? 'done'
                : (raw as GoalStatusLite);
          lite.push({
            id: r.id,
            title,
            status,
            thread: p.thread ?? '',
            // `payload.updated_at` is the in-payload timestamp the
            // Goals writer bumps on every save (server-side
            // timestamps were dropped). Falls back to the user's
            // intention `date` when missing on legacy entries.
            updatedAt: p.updated_at || p.date || '',
          });
        }
        setEntries(lite);
      })
      .catch(() => {
        // Silent — Goals page is responsible for surfacing errors.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, goalsVersion]);

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

interface PrimaryColumnProps {
  name: string;
  moodEntries: ReadonlyArray<MoodEntryLite>;
}

function PrimaryColumn({ name, moodEntries }: PrimaryColumnProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <PageHeading className="mb-0">
        {name ? `Bonjour, ${name}.` : 'Bonjour.'}
      </PageHeading>
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
  goalEntries: ReadonlyArray<GoalEntryLite>;
}

function SideColumn({ moodEntries, goalEntries }: SideColumnProps) {
  return (
    <aside className="sticky top-20 flex min-w-0 flex-col gap-6 self-start">
      <MoodBlock entries={moodEntries} />
      <HabitsBlock />
      <IntentionsBlock entries={goalEntries} />
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

const HOME_GOAL_LIMIT = 5;

const STATUS_TONE: Record<GoalStatusLite, string> = {
  open: 'border-hair bg-bg',
  wip: 'border-accent bg-accent',
  done: 'border-accent bg-accent',
};

const STATUS_LABEL: Record<GoalStatusLite, string> = {
  open: 'ouvert',
  wip: 'en cours',
  done: 'terminé',
};

/**
 * Real-data block on the Home aside : surfaces the goals the
 * user is actively working on (`wip`) plus the most recently
 * touched `open` goals as a short to-do list. Done goals are
 * filtered out — the block is for « what's on my plate », not
 * « what I've achieved » (the Goals page archives section
 * covers the latter).
 *
 * Order: `wip` first (most recently updated), then `open`
 * (most recently updated), capped at 5 items so the side
 * column doesn't explode. Each row is a link to the Goals
 * page filtered to the matching status — no individual focus
 * reader yet (#64 tracks that).
 */
function IntentionsBlock({ entries }: { entries: ReadonlyArray<GoalEntryLite> }) {
  const visible = useMemo(() => {
    const wip = [...entries.filter((e) => e.status === 'wip')];
    const open = [...entries.filter((e) => e.status === 'open')];
    const byUpdated = (a: GoalEntryLite, b: GoalEntryLite) =>
      b.updatedAt.localeCompare(a.updatedAt);
    wip.sort(byUpdated);
    open.sort(byUpdated);
    return [...wip, ...open].slice(0, HOME_GOAL_LIMIT);
  }, [entries]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Goals</SectionLabel>
        <Link
          to="/flow/goals"
          className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </Link>
      </div>
      {visible.length === 0 ? (
        <p className="text-[12px] italic text-muted">
          Aucun goal en cours.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((g) => (
            <li key={g.id}>
              <Link
                to="/flow/goals"
                className="group flex items-baseline gap-2 text-[12.5px] text-ink transition-colors hover:text-accent"
                title={STATUS_LABEL[g.status]}
              >
                <span
                  aria-hidden="true"
                  className={cn(
                    'mt-1 inline-block h-1.5 w-1.5 shrink-0 rounded-full border',
                    STATUS_TONE[g.status],
                  )}
                />
                <span className="min-w-0 flex-1 truncate">{g.title}</span>
                {g.thread ? (
                  <span className="shrink-0 text-[10px] uppercase tracking-[0.04em] text-muted">
                    {firstThread(g.thread)}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function firstThread(thread: string): string {
  const first = thread.split(',')[0];
  return first ? first.trim() : '';
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
