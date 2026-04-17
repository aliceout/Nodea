import { lazy, Suspense, type ComponentType, type ReactElement } from 'react';
import {
  HomeIcon,
  SparklesIcon,
  ArrowsRightLeftIcon,
  Cog6ToothIcon,
  CheckCircleIcon,
  FireIcon,
  BookOpenIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';
import { ErrorBoundary } from '@/ui/atoms/feedback/ErrorBoundary';

/**
 * Lazy-load every module. Each module ships in its own chunk; opening
 * "Mood" for the first time fetches only Mood's code.
 *
 * Replaces the previous pattern that instantiated `<Mood />` at module
 * import time (closing the "JSX instancié à l'import" finding).
 */
const Home = lazy(() => import('@/app/flow/Homepage'));
const Mood = lazy(() => import('@/app/flow/Mood'));
const Passage = lazy(() => import('@/app/flow/Passage'));
const Goals = lazy(() => import('@/app/flow/Goals'));
const Habits = lazy(() => import('@/app/flow/Habits'));
const Library = lazy(() => import('@/app/flow/Library'));
const Review = lazy(() => import('@/app/flow/Review'));
const Account = lazy(() => import('@/app/flow/Account'));
const Settings = lazy(() => import('@/app/flow/Settings'));
const Admin = lazy(() => import('@/app/flow/Admin'));

/**
 * Thin wrapper so the renderer doesn't have to repeat the per-module
 * ErrorBoundary + Suspense dance. A crash in one module stays confined.
 */
function lazyModule(id: string, Component: ComponentType): ReactElement {
  return (
    <ErrorBoundary scope={`le module « ${id} »`}>
      <Suspense fallback={<div className="p-6 text-center opacity-60">Chargement…</div>}>
        <Component />
      </Suspense>
    </ErrorBoundary>
  );
}

export interface ModuleDef {
  id: string;
  label: string;
  collection: string | null;
  element: ReactElement;
  to_toggle: boolean;
  description: string;
  icon: ComponentType<{ className?: string }>;
  display: boolean;
}

export const MODULES: readonly ModuleDef[] = [
  {
    id: 'home',
    label: 'modules.home.label',
    collection: null,
    element: lazyModule('home', Home),
    to_toggle: false,
    description: 'modules.home.description',
    icon: HomeIcon,
    display: true,
  },
  {
    id: 'mood',
    label: 'modules.mood.label',
    collection: 'mood_entries',
    element: lazyModule('mood', Mood),
    to_toggle: true,
    description: 'modules.mood.description',
    icon: SparklesIcon,
    display: true,
  },
  {
    id: 'passage',
    label: 'modules.passage.label',
    collection: 'passage_entries',
    element: lazyModule('passage', Passage),
    to_toggle: true,
    description: 'modules.passage.description',
    icon: ArrowsRightLeftIcon,
    display: true,
  },
  {
    id: 'goals',
    label: 'modules.goals.label',
    collection: 'goals_entries',
    element: lazyModule('goals', Goals),
    to_toggle: true,
    description: 'modules.goals.description',
    icon: CheckCircleIcon,
    display: true,
  },
  {
    id: 'habits',
    label: 'modules.habits.label',
    collection: 'habits_items_entries',
    element: lazyModule('habits', Habits),
    to_toggle: true,
    description: 'modules.habits.description',
    icon: FireIcon,
    display: true,
  },
  {
    id: 'library',
    label: 'modules.library.label',
    collection: 'library_items_entries',
    element: lazyModule('library', Library),
    to_toggle: true,
    description: 'modules.library.description',
    icon: BookOpenIcon,
    display: true,
  },
  {
    id: 'review',
    label: 'modules.review.label',
    collection: 'review_entries',
    element: lazyModule('review', Review),
    to_toggle: true,
    description: 'modules.review.description',
    icon: CalendarIcon,
    display: true,
  },
  {
    id: 'account',
    label: 'modules.account.label',
    collection: null,
    element: lazyModule('account', Account),
    to_toggle: false,
    description: 'modules.account.description',
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: 'settings',
    label: 'modules.settings.label',
    collection: null,
    element: lazyModule('settings', Settings),
    to_toggle: false,
    description: 'modules.settings.description',
    icon: Cog6ToothIcon,
    display: false,
  },
  {
    id: 'admin',
    label: 'modules.admin.label',
    collection: null,
    element: lazyModule('admin', Admin),
    to_toggle: false,
    description: 'modules.admin.description',
    icon: Cog6ToothIcon,
    display: false,
  },
];

export const getModuleById = (id: string): ModuleDef | null =>
  MODULES.find((m) => m.id === id) ?? null;
