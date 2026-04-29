import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

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

import { preferredName } from './lib/format';
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
  readings: ReadonlyArray<LibraryReadingLite>;
}

const HomepageDataContext = createContext<HomepageDataValue | null>(null);

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
  const libraryItemsVersion = useNodeaStore((s) => s.libraryItemsVersion);
  const { language } = useI18n();

  const moodModuleId = modules['mood']?.moduleUserId ?? null;
  const goalsModuleId = modules['goals']?.moduleUserId ?? null;
  const libraryModuleId = modules['library']?.moduleUserId ?? null;

  const [mood, setMood] = useState<MoodEntryLite[]>([]);
  const [goals, setGoals] = useState<GoalEntryLite[]>([]);
  const [readings, setReadings] = useState<LibraryReadingLite[]>([]);

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
    if (!mainKey || !libraryModuleId) return undefined;
    let cancelled = false;
    libraryItemsClient
      .list(libraryModuleId, mainKey)
      .then((records) => {
        if (cancelled) return;
        setReadings(projectLibraryReadings(records));
      })
      .catch(() => {
        // Silent — Library page surfaces the real error.
      });
    return () => {
      cancelled = true;
    };
  }, [mainKey, libraryModuleId, libraryItemsVersion]);

  // ---- Derived ----

  const displayName = useMemo(() => preferredName(user), [user]);

  // « samedi 25 avril 2025 · jour 116 ». Re-computed on every
  // render so it stays correct across midnight, but cheap (one
  // formatter + a few date arithmetic ops).
  const formattedDate = useMemo(() => {
    const now = new Date();
    const localeTag = language === 'en' ? 'en-US' : 'fr-FR';
    const formatter = new Intl.DateTimeFormat(localeTag, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
    const dayOfYear = Math.floor(
      (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) /
        86_400_000,
    );
    return `${formatter.format(now)} · jour ${dayOfYear}`;
  }, [language]);

  const value = useMemo<HomepageDataValue>(
    () => ({ displayName, formattedDate, mood, goals, readings }),
    [displayName, formattedDate, mood, goals, readings],
  );

  return (
    <HomepageDataContext.Provider value={value}>
      {children}
    </HomepageDataContext.Provider>
  );
}
