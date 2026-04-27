import { Fragment } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  BookOpenIcon,
  CalendarIcon,
  CheckCircleIcon,
  DocumentTextIcon,
  FireIcon,
  HeartIcon,
  HomeIcon,
} from '@heroicons/react/24/outline';

import { useNodeaStore, selectModules } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  /** Override the URL — defaults to `/flow/${id}` when omitted. */
  href?: string;
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
  { id: 'habits', label: 'Habits', icon: FireIcon },
  { id: 'library', label: 'Library', icon: BookOpenIcon },
  { id: 'review', label: 'Review', icon: CalendarIcon },
];

/**
 * Library splits into three lenses on the same data: the books
 * themselves, the highlighted extracts (`reviews.kind === 'quote'`),
 * and the freeform notes (`reviews.kind === 'note'`). All three
 * routes resolve to `/flow/library` with a `?subview=` query param —
 * we don't need a separate router branch since the LibraryPage
 * already conditions its render on the param.
 */
type LibrarySubview = 'livres' | 'extraits' | 'notes';
interface LibrarySubItem {
  subview: LibrarySubview;
  label: string;
}
const LIBRARY_SUB_ITEMS: readonly LibrarySubItem[] = [
  { subview: 'livres', label: 'Livres' },
  { subview: 'extraits', label: 'Extraits' },
  { subview: 'notes', label: 'Notes' },
];

interface SidebarNavProps {
  onNavigate: () => void;
}

export default function SidebarNav({ onNavigate }: SidebarNavProps) {
  const { moduleId } = useParams();
  const [searchParams] = useSearchParams();
  const current = moduleId ?? 'home';
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

  // The active Library sub-view tracks `?subview=` — defaults to
  // `livres` when the user lands on `/flow/library` without a query
  // string, matching the LibraryPage's own default.
  const librarySubview = (searchParams.get('subview') ?? 'livres') as LibrarySubview;

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
  const navigate = useNavigate();
  const href = item.href ?? `/flow/${item.id}`;
  const Icon = item.icon;

  return (
    <button
      type="button"
      onClick={() => {
        navigate(href);
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
  const navigate = useNavigate();
  return (
    <ul className="ml-7 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-hair pl-2">
      {LIBRARY_SUB_ITEMS.map((sub) => {
        const active = activeSubview === sub.subview;
        return (
          <li key={sub.subview}>
            <button
              type="button"
              onClick={() => {
                navigate(`/flow/library?subview=${sub.subview}`);
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
