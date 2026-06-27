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
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

interface NavItem {
  id: ModuleId;
  /** i18n key for the visible label (under `layout.nav.*`). */
  labelKey: string;
  /** Heroicon to render before the label. Main items only — sub-items
   * (Library categories) sit under their group eyebrow and stay
   * icon-less for visual hierarchy. */
  icon?: typeof HomeIcon;
}

const MAIN_ITEMS: NavItem[] = [
  { id: 'home', labelKey: 'layout.nav.home', icon: HomeIcon },
  { id: 'mood', labelKey: 'layout.nav.mood', icon: HeartIcon },
  { id: 'journal', labelKey: 'layout.nav.journal', icon: DocumentTextIcon },
  { id: 'goals', labelKey: 'layout.nav.goals', icon: CheckCircleIcon },
  { id: 'library', labelKey: 'layout.nav.library', icon: BookOpenIcon },
  { id: 'review', labelKey: 'layout.nav.review', icon: CalendarIcon },
  { id: 'hrt', labelKey: 'layout.nav.hrt', icon: BeakerIcon },
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
  /** i18n key for the visible label (under `layout.nav.library*`). */
  labelKey: string;
}
const LIBRARY_SUB_ITEMS: readonly LibrarySubItem[] = [
  { subview: 'livres', labelKey: 'layout.nav.libraryBooks' },
  { subview: 'extraits', labelKey: 'layout.nav.libraryExtracts' },
  { subview: 'notes', labelKey: 'layout.nav.libraryNotes' },
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
  /** i18n key for the visible label (under `layout.nav.hrt*`). */
  labelKey: string;
}
const HRT_SUB_ITEMS: readonly HrtSubItem[] = [
  { subview: 'summary', labelKey: 'layout.nav.hrtSummary' },
  { subview: 'administration', labelKey: 'layout.nav.hrtAdministration' },
  { subview: 'labs', labelKey: 'layout.nav.hrtLabs' },
  { subview: 'export', labelKey: 'layout.nav.hrtExport' },
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
  const { t } = useI18n();
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
        'group flex w-full items-center px-2.5 py-[0.4125rem] text-left transition-[background-color,color,transform] duration-200',
        'text-[13.5px] text-ink-soft',
        active
          ? // Soft sage fill + deep-green text (calm, like the Tag /
            // right-sidebar FilterChip), with the icon kept at full accent
            // (see below) as a quiet wayfinding anchor. Tag `rounded`,
            // inset (no edge bleed).
            'bg-accent-soft font-medium text-accent-deep rounded'
          : 'rounded hover:translate-x-0.5 hover:bg-bg hover:text-ink',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <Icon
            className={cn('h-4 w-4 shrink-0', active && 'text-accent')}
            aria-hidden="true"
          />
        ) : null}
        <span className="truncate">{t(item.labelKey)}</span>
      </span>
    </button>
  );
}

interface LibrarySubNavProps {
  activeSubview: LibrarySubview;
  onNavigate: () => void;
}

function LibrarySubNav({ activeSubview, onNavigate }: LibrarySubNavProps) {
  const { t } = useI18n();
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
                'block w-full rounded px-2 py-[0.275rem] text-left text-[12.5px] transition-colors',
                active
                  ? 'bg-bg font-medium text-ink'
                  : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              {t(sub.labelKey)}
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
  const { t } = useI18n();
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
                'block w-full rounded px-2 py-[0.275rem] text-left text-[12.5px] transition-colors',
                active
                  ? 'bg-bg font-medium text-ink'
                  : 'text-muted hover:bg-bg hover:text-ink',
              )}
            >
              {t(sub.labelKey)}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
