import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { AnnouncementResponse } from '@nodea/shared';

import { apiListLiveAnnouncements } from '@/core/api/announcements';
import { goalsClient } from '@/core/api/modules/goals';
import { journalClient } from '@/core/api/modules/journal';
import { moodClient } from '@/core/api/modules/mood';
import {
  useNodeaStore,
  selectMainKey,
  selectModules,
  selectUser,
} from '@/core/store/nodea-store';
import { intlLocale } from '@/core/i18n/date-format';
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { preferredName } from './lib/format';
import {
  projectGoalEntries,
  projectJournalEntries,
  projectMoodEntries,
} from './lib/projections';
import type {
  GoalEntryLite,
  JournalEntryLite,
  MoodEntryLite,
} from './lib/types';

/**
 * Homepage page-local state, exposed through a single React
 * context. Home is **read-only** by design (no creation, no
 * mutation, no per-block filters), so it doesn't need the
 * three-context pattern that drives the rest of `flow/`. One
 * `<HomepageProvider>` + one `useHomepageData()` hook is enough.
 *
 * The provider hosts the three fetch effects (Mood / Goals /
 * Library), the derived `displayName` from the auth slice, and
 * the locale-aware « samedi 25 avril · jour 116 » header label.
 * Failures stay silent : each fetched module's own page is
 * responsible for surfacing its real error.
 */

interface HomepageDataValue {
  displayName: string;
  formattedDate: string;
  mood: ReadonlyArray<MoodEntryLite>;
  goals: ReadonlyArray<GoalEntryLite>;
  /** Journal entries, newest-first. Drives `ToSeeList`'s « Entrée
   *  Journal aujourd'hui » row, `RecentJournal`'s snippet preview,
   *  and `JournalHeatmap`'s density grid. */
  journal: ReadonlyArray<JournalEntryLite>;
  /** Live admin-authored announcements, newest-first. The server
   *  already filters on `active` + the optional start/end window
   *  so the array is rendered as-is by `AnnouncementsCard`. Empty
   *  array hides the card entirely. */
  announcements: ReadonlyArray<AnnouncementResponse>;
}

const HomepageDataContext = createContext<HomepageDataValue | null>(null);

// `HomepageProvider` lives below — this hook is its consumer
// counterpart. Splitting them across two files would only add
// ceremony.
// eslint-disable-next-line react-refresh/only-export-components
export function useHomepageData(): HomepageDataValue {
  const v = useContext(HomepageDataContext);
  if (!v) throw new Error('useHomepageData() must be used inside <HomepageProvider>');
  return v;
}

/* ---- Provider --------------------------------------------------- */

export function HomepageProvider({ children }: { children: ReactNode }) {
  const user = useNodeaStore(selectUser);
  const mainKey = useNodeaStore(selectMainKey);
  const modules = useNodeaStore(selectModules);
  const moodVersion = useNodeaStore((s) => s.moodVersion);
  const goalsVersion = useNodeaStore((s) => s.goalsVersion);
  const journalVersion = useNodeaStore((s) => s.journalVersion);
  const { t, language } = useI18n();

  const moodModuleId = modules['mood']?.moduleUserId ?? null;
  const goalsModuleId = modules['goals']?.moduleUserId ?? null;
  const journalModuleId = modules['journal']?.moduleUserId ?? null;

  const [mood, setMood] = useState<MoodEntryLite[]>([]);
  const [goals, setGoals] = useState<GoalEntryLite[]>([]);
  const [journal, setJournal] = useState<JournalEntryLite[]>([]);
  const [announcements, setAnnouncements] = useState<AnnouncementResponse[]>([]);

  // ---- Fetch effects (one per module). Failures are silenced —
  // the matching module's own page surfaces real errors. ----

  useEffect(() => {
    if (!mainKey || !moodModuleId) return undefined;
    let cancelled = false;
    moodClient
      .list(moodModuleId, mainKey)
      .then((records) => {
        if (cancelled) return;
        setMood(projectMoodEntries(records));
      })
      .catch(() => {
        // Silent on Home — Mood page surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, moodModuleId, moodVersion]);

  useEffect(() => {
    if (!mainKey || !goalsModuleId) return undefined;
    let cancelled = false;
    goalsClient
      .list(goalsModuleId, mainKey)
      .then((records) => {
        if (cancelled) return;
        setGoals(projectGoalEntries(records));
      })
      .catch(() => {
        // Silent — Goals page surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, goalsModuleId, goalsVersion]);

  useEffect(() => {
    if (!mainKey || !journalModuleId) return undefined;
    let cancelled = false;
    journalClient
      .list(journalModuleId, mainKey)
      .then((records) => {
        if (cancelled) return;
        setJournal(projectJournalEntries(records));
      })
      .catch(() => {
        // Silent — Journal page surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, journalModuleId, journalVersion]);

  // Public announcements — fetched once per Homepage mount (no
  // store version slice, no refetch trigger). Failures stay silent
  // since the announcements card hides itself when the array is
  // empty, which is the same UX an offline / errored request lands
  // on. The user logs in and reaches the home before the SSE /
  // periodic-poll story is in place ; if an admin pushes mid-
  // session, a page refresh picks it up.
  useEffect(() => {
    let cancelled = false;
    apiListLiveAnnouncements()
      .then((rows) => {
        if (cancelled) return;
        setAnnouncements(rows);
      })
      .catch(() => {
        // Silent — empty array hides the card.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // ---- Derived ----

  const displayName = useMemo(() => preferredName(user), [user]);

  // Track the calendar day with a cheap 1-minute poll so the header
  // flips at midnight without a reload. The old comment claimed a
  // per-render recompute, but the memo was keyed on `[language]`
  // only — an app left open overnight kept yesterday's header
  // (audit 2026-06).
  const [todayKey, setTodayKey] = useState(() => new Date().toDateString());
  useEffect(() => {
    const id = setInterval(() => {
      const next = new Date().toDateString();
      setTodayKey((cur) => (cur === next ? cur : next));
    }, 60_000);
    return () => clearInterval(id);
  }, []);

  // « samedi 25 avril 2025 · jour 116 ».
  const formattedDate = useMemo(() => {
    // `todayKey` parses back to local midnight of the current day.
    const now = new Date(todayKey);
    const formatter = new Intl.DateTimeFormat(intlLocale(language), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    // Day-of-year via UTC timestamps of the LOCAL calendar dates —
    // immune to the DST off-by-one a raw millisecond division had
    // the day after a clock change (audit 2026-06).
    const dayOfYear = Math.round(
      (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) -
        Date.UTC(now.getFullYear(), 0, 0)) /
        86_400_000,
    );
    return `${formatter.format(now)} · ${t('home.header.dayOfYear', {
      values: { day: dayOfYear },
    })}`;
  }, [language, todayKey, t]);

  const value = useMemo<HomepageDataValue>(
    () => ({ displayName, formattedDate, mood, goals, journal, announcements }),
    [displayName, formattedDate, mood, goals, journal, announcements],
  );

  return (
    <HomepageDataContext.Provider value={value}>
      {children}
    </HomepageDataContext.Provider>
  );
}
