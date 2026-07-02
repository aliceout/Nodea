import { Fragment } from 'react';
import {
  ArrowPathIcon,
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
import { useSlidingIndicator } from '@/ui/dirk/use-sliding-indicator';

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
  { id: 'cycle', labelKey: 'layout.nav.cycle', icon: ArrowPathIcon },
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
  /** Desktop shell only: the user's persisted collapse choice (icon rail
   *  vs full). Forced rail when true; auto-rail on `md`–`lg` otherwise. */
  collapsed?: boolean;
  /** True inside the mobile drawer — always full labels, never a rail. */
  drawer?: boolean;
}

export default function SidebarNav({
  onNavigate,
  collapsed = false,
  drawer = false,
}: SidebarNavProps) {
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

  // Single highlight that glides to the active module button (the same
  // sliding affordance as the Account / Admin tab strip, vertical here).
  // `:scope >` keeps it on the main module buttons — sub-nav lenses are
  // nested in their own `<ul>` and keep their own static highlight. Only a
  // module SWITCH animates; the collapse/expand toggle (which reflows row
  // heights + widths) and resizes snap, so the highlight never trails the
  // sidebar's width animation.
  const { ref, state } = useSlidingIndicator(
    current,
    `${visible.map((v) => v.id).join(',')}|${collapsed}|${drawer}`,
    ':scope > button[data-active="true"]',
  );

  return (
    <div ref={ref} className="relative flex flex-col gap-0.5">
      {state ? (
        <span
          aria-hidden="true"
          className={cn(
            // Only transform animates (rows share a width); duration toggles
            // between a glide and a snap so collapse/expand never trails.
            'pointer-events-none absolute left-0 top-0 rounded bg-accent-soft transition-transform ease-[cubic-bezier(0.2,0.7,0.3,1)] motion-reduce:transition-none',
            state.animate ? 'duration-300' : 'duration-0',
          )}
          style={{
            transform: `translate(${state.rect.left}px, ${state.rect.top}px)`,
            width: state.rect.width,
            height: state.rect.height,
          }}
        />
      ) : null}
      {visible.map((item) => (
        <Fragment key={item.id}>
          <SidebarItem
            item={item}
            active={current === item.id}
            onNavigate={onNavigate}
            collapsed={collapsed}
            drawer={drawer}
          />
          {item.id === 'library' && current === 'library' ? (
            <LibrarySubNav
              activeSubview={librarySubview}
              onNavigate={onNavigate}
              collapsed={collapsed}
              drawer={drawer}
            />
          ) : null}
          {item.id === 'hrt' && current === 'hrt' ? (
            <HrtSubNav
              activeSubview={hrtSubview}
              onNavigate={onNavigate}
              collapsed={collapsed}
              drawer={drawer}
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
  collapsed?: boolean;
  drawer?: boolean;
}

function SidebarItem({
  item,
  active,
  onNavigate,
  collapsed = false,
  drawer = false,
}: SidebarItemProps) {
  const { t } = useI18n();
  const setModule = useNodeaStore((s) => s.setModule);
  const Icon = item.icon;
  const label = t(item.labelKey);
  // Rail = forced (`collapsed`) or the `md`–`lg` auto-rail (`lg:` variants
  // when not collapsed); never in the drawer. In the rail the icon is
  // centered + enlarged and the text label becomes a hover tooltip.
  const labelHidden = drawer ? '' : collapsed ? 'hidden' : 'hidden lg:inline';

  return (
    <button
      type="button"
      onClick={() => {
        setModule(item.id);
        onNavigate();
      }}
      data-active={active}
      aria-current={active ? 'page' : undefined}
      // The visible label disappears in the rail, so the accessible name +
      // hover tooltip come from `aria-label` / `title` (kept always — they
      // just duplicate the visible text in the full sidebar).
      aria-label={label}
      title={label}
      className={cn(
        // `relative z-10` lifts the button above the shared sliding
        // highlight (rendered behind in `SidebarNav`); the active fill now
        // comes from that gliding element, so the button itself stays
        // transparent and only its text / icon colour changes.
        'group relative z-10 flex w-full items-center rounded px-2.5 py-[0.4125rem] text-left transition-[background-color,color,transform] duration-200',
        'text-[13.5px] text-ink-soft',
        drawer ? '' : collapsed ? 'justify-center' : 'justify-center lg:justify-start',
        active
          ? // Deep-green text, with the icon kept at full accent (see below)
            // as a quiet wayfinding anchor. The soft sage fill is the
            // sliding highlight behind.
            'font-medium text-accent-deep'
          : 'hover:translate-x-0.5 hover:bg-bg hover:text-ink',
      )}
    >
      <span className="flex min-w-0 items-center gap-2.5">
        {Icon ? (
          <Icon
            className={cn(
              'shrink-0',
              active && 'text-accent',
              // Bigger glyph in the rail (« grosses icônes »), back to the
              // compact size in the full sidebar.
              drawer ? 'h-4 w-4' : collapsed ? 'h-5 w-5' : 'h-5 w-5 lg:h-4 lg:w-4',
            )}
            aria-hidden="true"
          />
        ) : null}
        <span className={cn('truncate', labelHidden)}>{label}</span>
      </span>
    </button>
  );
}

interface LibrarySubNavProps {
  activeSubview: LibrarySubview;
  onNavigate: () => void;
  collapsed?: boolean;
  drawer?: boolean;
}

function LibrarySubNav({
  activeSubview,
  onNavigate,
  collapsed = false,
  drawer = false,
}: LibrarySubNavProps) {
  const { t } = useI18n();
  const setModule = useNodeaStore((s) => s.setModule);
  const setLibrarySubview = useNodeaStore((s) => s.setLibrarySubview);
  return (
    <ul
      className={cn(
        'ml-7 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-hair pl-2',
        // Text sub-items can't live in the 68 px rail — hide them there
        // (the active module icon still shows in the rail above).
        drawer ? '' : collapsed ? 'hidden' : 'hidden lg:flex',
      )}
    >
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
  collapsed?: boolean;
  drawer?: boolean;
}

function HrtSubNav({
  activeSubview,
  onNavigate,
  collapsed = false,
  drawer = false,
}: HrtSubNavProps) {
  const { t } = useI18n();
  const setModule = useNodeaStore((s) => s.setModule);
  const setHrtSubview = useNodeaStore((s) => s.setHrtSubview);
  return (
    <ul
      className={cn(
        'ml-7 mt-0.5 mb-0.5 flex flex-col gap-0.5 border-l border-hair pl-2',
        // Text sub-items can't live in the 68 px rail — hide them there
        // (the active module icon still shows in the rail above).
        drawer ? '' : collapsed ? 'hidden' : 'hidden lg:flex',
      )}
    >
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
