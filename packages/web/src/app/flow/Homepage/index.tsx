import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { type MoodScore } from '@nodea/shared';

import { goalsClient } from '@/core/api/modules/goals';
import { libraryItemsClient } from '@/core/api/modules/library';
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

import {
  HOME_GOAL_LIMIT,
  MOCK_TASKS,
  MOOD_BLOCK_FILL,
  MOOD_FRISE_DAYS,
  STATUS_LABEL,
  STATUS_TONE,
} from './lib/constants';
import {
  firstThread,
  formatMoodAvg,
  formatTimeFromIso,
  preferredName,
  signedScore,
  toIsoDate,
} from './lib/format';
import { buildMoodFrise, summariseMoodFrise } from './lib/frise';
import { pickHomeGoals } from './lib/intentions';
import {
  projectGoalEntries,
  projectLibraryReadings,
  projectMoodEntries,
} from './lib/projections';
import type {
  GoalEntryLite,
  LibraryReadingLite,
  MoodEntryLite,
} from './lib/types';

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

  const displayName = useMemo(() => preferredName(user), [user]);
  const moodEntries = useMoodEntries();
  const goalEntries = useGoalEntries();
  const readings = useLibraryReadings();

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
      <PrimaryColumn
        name={displayName}
        moodEntries={moodEntries}
        readings={readings}
      />
    </ModuleShell>
  );
}

/**
 * One-shot fetch + projection of the user's Mood entries. Re-runs
 * whenever `moodVersion` is bumped (the Composer's MoodBody
 * increments it after a successful create), so newly saved entries
 * appear on Home without a page reload. Failures are silenced —
 * the Mood page surfaces the real error.
 *
 * The pure projection logic lives in `lib/projections.ts` ; this
 * hook just wires the fetch lifecycle around it.
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
        setEntries(projectMoodEntries(records));
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

/**
 * One-shot fetch + projection of the user's Goals. Re-runs
 * whenever `goalsVersion` is bumped. Failures stay silent — the
 * Goals page surfaces the real error. Projection logic lives in
 * `lib/projections.ts`.
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
        setEntries(projectGoalEntries(records));
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

/**
 * One-shot fetch of the user's Library items, filtered to those
 * currently being read. Re-runs on every `libraryItemsVersion`
 * bump. Failures stay silent — the Library page surfaces the
 * real error. Projection logic lives in `lib/projections.ts`.
 */
function useLibraryReadings(): LibraryReadingLite[] {
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moduleUserId = modules['library']?.moduleUserId ?? null;
  const itemsVersion = useNodeaStore((s) => s.libraryItemsVersion);

  const [entries, setEntries] = useState<LibraryReadingLite[]>([]);

  useEffect(() => {
    if (!mainKey || !moduleUserId) return undefined;
    let cancelled = false;
    libraryItemsClient
      .list(moduleUserId, mainKey)
      .then((records) => {
        if (cancelled) return;
        setEntries(projectLibraryReadings(records));
      })
      .catch(() => {
        // Silent — Library page is responsible for surfacing errors.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moduleUserId, itemsVersion]);

  return entries;
}

interface PrimaryColumnProps {
  name: string;
  moodEntries: ReadonlyArray<MoodEntryLite>;
  readings: ReadonlyArray<LibraryReadingLite>;
}

function PrimaryColumn({ name, moodEntries, readings }: PrimaryColumnProps) {
  return (
    <section className="flex min-h-0 min-w-0 flex-col">
      <PageHeading className="mb-0">
        {name ? `Bonjour, ${name}.` : 'Bonjour.'}
      </PageHeading>
      <p className="mt-1 mb-[22px] text-[14px] text-muted">Trois choses à voir aujourd&rsquo;hui.</p>

      <ToSeeList moodEntries={moodEntries} />
      <ReadingBlock readings={readings} />
      <RecentPassage />
    </section>
  );
}

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
    </aside>
  );
}

/**
 * 14-day mood strip on Home. Reads from the lifted
 * `useMoodEntries` hook on the Home parent — the same fetch
 * powers `ToSeeList`'s dynamic Mood task. Days without an entry
 * render as a faint outline so gaps stay visible without faking
 * a zero.
 *
 * Smaller-by-design than the Mood page's 52-week frise — this is
 * a glance, not a chart. Click-through could land on `/flow/mood`
 * later if we want a navigable version.
 */
function MoodBlock({ entries }: { entries: ReadonlyArray<MoodEntryLite> }) {
  const cells = useMemo(() => buildMoodFrise(entries), [entries]);
  const stats = useMemo(() => summariseMoodFrise(cells), [cells]);

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

/**
 * Real-data block on the Home aside : surfaces the goals the
 * user is actively working on (`wip`) plus the most recently
 * touched `open` goals as a short to-do list. Done goals are
 * filtered out — the block is for « what's on my plate », not
 * « what I've achieved » (the Goals page archives section
 * covers the latter).
 *
 * Selection logic lives in `lib/intentions.ts` (`pickHomeGoals`) :
 * `wip` first (most recently updated), then `open` (most recently
 * updated), capped at `HOME_GOAL_LIMIT` items so the side column
 * doesn't explode. Each row is a link to the Goals page — no
 * individual focus reader yet (#64 tracks that).
 */
function IntentionsBlock({ entries }: { entries: ReadonlyArray<GoalEntryLite> }) {
  const setModule = useNodeaStore((s) => s.setModule);
  const goToGoals = () => setModule('goals');
  const visible = useMemo(() => pickHomeGoals(entries), [entries]);

  return (
    <section>
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>Goals</SectionLabel>
        <button
          type="button"
          onClick={goToGoals}
          className="cursor-pointer text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="text-[12px] italic text-muted">
          Aucun goal en cours.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {visible.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                onClick={goToGoals}
                className="group flex w-full cursor-pointer items-baseline gap-2 text-left text-[12.5px] text-ink transition-colors hover:text-accent"
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
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * « En cours de lecture » block on the home primary column. Reads
 * from `useLibraryReadings` (which filters Library items to
 * `status === 'in_progress'`). The block shows nothing if no
 * book is currently being read — the section heading hides too,
 * so a user without an in-progress book doesn't see an empty
 * « En cours de lecture » header staring back.
 *
 * Each row is a `<Link>` to /flow/library/livres ; opening a
 * specific book in detail (#?) is left for a follow-up.
 */
function ReadingBlock({
  readings,
}: {
  readings: ReadonlyArray<LibraryReadingLite>;
}) {
  if (readings.length === 0) return null;
  return (
    <section className="mt-7">
      <div className="mb-2 flex items-baseline justify-between">
        <SectionLabel>En cours de lecture</SectionLabel>
        <Link
          to="/flow/library"
          className="text-[11px] text-muted underline-offset-2 transition-colors hover:text-accent hover:underline"
        >
          tout voir →
        </Link>
      </div>
      <ul>
        {readings.map((b) => (
          <li
            key={b.id}
            className="flex items-baseline justify-between gap-3 border-b border-hair py-[5px] last:border-b-0"
          >
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5 truncate text-[13px] font-medium text-ink">
                {b.isFavorite ? (
                  <span aria-hidden="true" className="text-accent">
                    ★
                  </span>
                ) : null}
                <span className="truncate">{b.title}</span>
              </div>
              {b.author ? (
                <div className="truncate text-[11px] text-muted">{b.author}</div>
              ) : null}
            </div>
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
