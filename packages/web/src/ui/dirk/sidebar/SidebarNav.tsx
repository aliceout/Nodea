import { Fragment } from 'react';
import {
  BeakerIcon,
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  HeartIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

import {
  useNodeaStore,
  selectModules,
  selectCurrentModule,
  selectLibrarySubview,
  selectHrtSubview,
  type ModuleId,
  type LibrarySubview,
  type HrtSubview,
} from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

interface NavItem {
  id: ModuleId;
  label: string;
  /** Heroicon to render before the label. Main items only — sub-items
   * (Library categories) sit under their group eyebrow and stay
   * icon-less for visual hierarchy. */
  icon?: typeof HomeIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'home', label: 'Aujourd’hui', icon: HomeIcon },
  { id: 'mood', label: 'Mood', icon: HeartIcon },
  { id: 'journal', label: 'Journal', icon: DocumentTextIcon },
  { id: 'goals', label: 'Goals', icon: CheckCircleIcon },
  // Habits temporairement retiré — module dormant (cf. commentaire
  // dans `modules-registry.tsx` et issue #98). Le code reste en
  // place, juste pas exposé dans la nav le temps que l'expérience
  // produit soit tranchée.
  { id: 'library', label: 'Library', icon: BookOpenIcon },
  { id: 'review', label: 'Review', icon: CalendarIcon },
  { id: 'hrt', label: 'HRT', icon: BeakerIcon },
];

/**
 * Library splits into three lenses on the same data: the books
 * themselves, the highlighted extracts (`reviews.kind === 'quote'`),
 * and the freeform notes (`reviews.kind === 'note'`). The active
 * lens is `librarySubview` in the flow slice — never an URL query
 * param, so it doesn't leak in server logs.
 */
interface LibrarySubItem {
  subview: LibrarySubview;
  label: string;
}
const LIBRARY_SUB_ITEMS: readonly LibrarySubItem[] = [
  { subview: 'livres', label: 'Livres' },
  { subview: 'extraits', label: 'Extraits' },
  { subview: 'notes', label: 'Notes' },
];

/**
 * HRT opens on the `summary` dashboard (which absorbed the product
 * catalog), then the administration log (each dose/injection, timed),
 * the lab results with their chart, and a printable doctor `export`.
 * Active lens is `hrtSubview` in the flow slice — same no-URL-leak
 * contract as Library.
 */
interface HrtSubItem {
  subview: HrtSubview;
  label: string;
}
const HRT_SUB_ITEMS: readonly HrtSubItem[] = [
  { subview: 'summary', label: 'Synthèse' },
  { subview: 'administration', label: 'Administration' },
  { subview: 'labs', label: 'Analyses' },
  { subview: 'export', label: 'Outils' },
];

interface SidebarNavProps {
  onNavigate: () => void;
}

export default function SidebarNav({ onNavigate }: SidebarNavProps) {
  const current = useNodeaStore(selectCurrentModule);
  const librarySubview = useNodeaStore(selectLibrarySubview);
  const hrtSubview = useNodeaStore(selectHrtSubview);
  const modulesRuntime = useNodeaStore(selectModules);

  // Filter by toggle state, but keep the home item always visible.
  const enabledIds = new Set(
    Object.entries(modulesRuntime)
      .filter(([, entry]) => entry?.enabled)
      .map(([id]) => id),
  );

  const visible = MAIN_ITEMS.filter(
    (item) => item.id === 'home' || enabledIds.has(item.id),
  );

  return (
    <div className="flex flex-col gap-0.5">
      {visible.map((item) => (
        <Fragment key={item.id}>
          <SidebarItem
            item={item}
            active={current === item.id}
            onNavigate={onNavigate}
          />
          {item.id === 'library' && current === 'library' ? (
            <LibrarySubNav
              activeSubview={librarySubview}
              onNavigate={onNavigate}
            />
          ) : null}
          {item.id === 'hrt' && current === 'hrt' ? (
            <HrtSubNav activeSubview={hrtSubview} onNavigate={onNavigate} />
          ) : null}
        </Fragment>
      ))}
    </div>
  );
}

interface SidebarItemProps {
  item: NavItem;
  active: boolean;
  onNavigate: () => void;
}

function SidebarItem({ item, active, onNavigate }: SidebarItemProps) {
  const setModule = useNodeaStore((s) => s.setModule);
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => {
        setModule(item.id);
        onNavigate();
      }}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'group flex w-full items-center rounded-md px-2.5 py-1.5 text-left transition-[background-color,color,transform] duration-200',
        'text-[13.5px] text-ink-soft',
        active
          ? 'bg-accent text-white'
          : 'hover:translate-x-0.5 hover:bg-bg hover:text-ink',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? <Icon className="h-4 w-4 shrink-0" aria-hidden="true" /> : null}
        <span className="truncate">{item.label}</span>
      </span>
    </button>
  );
}

interface LibrarySubNavProps {
  activeSubview: LibrarySubview;
  onNavigate: () => void;
}

function LibrarySubNav({ activeSubview, onNavigate }: LibrarySubNavProps) {
  const setModule = useNodeaStore((s) => s.setModule);
  const setLibrarySubview = useNodeaStore((s) => s.setLibrarySubview);
  return (
    <ul className="ml-7 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-hair pl-2">
      {LIBRARY_SUB_ITEMS.map((sub) => {
        const active = activeSubview === sub.subview;
        return (
          <li key={sub.subview}>
            <button
              type="button"
              onClick={() => {
                // Two-step : ensure we're on Library (no-op if already
                // there, so no extra history entry), then swap the
                // lens. Subview is its own slice — switching it
                // doesn't push history because we don't want each
                // tab-flip to spawn a back-stack entry.
                setModule('library');
                setLibrarySubview(sub.subview);
                onNavigate();
              }}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'block w-full rounded-md px-2 py-1 text-left text-[12.5px] transition-colors',
                active
                  ? 'bg-bg font-medium text-ink'
                  : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              {sub.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}

interface HrtSubNavProps {
  activeSubview: HrtSubview;
  onNavigate: () => void;
}

function HrtSubNav({ activeSubview, onNavigate }: HrtSubNavProps) {
  const setModule = useNodeaStore((s) => s.setModule);
  const setHrtSubview = useNodeaStore((s) => s.setHrtSubview);
  return (
    <ul className="ml-7 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-hair pl-2">
      {HRT_SUB_ITEMS.map((sub) => {
        const active = activeSubview === sub.subview;
        return (
          <li key={sub.subview}>
            <button
              type="button"
              onClick={() => {
                // Same two-step as Library : ensure we're on HRT
                // (no-op if already there → no extra history entry),
                // then swap the lens. Subview is its own slice — no
                // history push, so tab-flips don't pollute the
                // back-stack.
                setModule('hrt');
                setHrtSubview(sub.subview);
                onNavigate();
              }}
              data-active={active}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'block w-full rounded-md px-2 py-1 text-left text-[12.5px] transition-colors',
                active
                  ? 'bg-bg font-medium text-ink'
                  : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              {sub.label}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
