import { useEffect, useMemo, useState } from 'react';
import {
  ArrowPathIcon,
  PencilSquareIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';

import { useNodeaStore } from '@/core/store/nodea-store';
import { cn } from '@/lib/utils';
import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import { Modal } from '@/ui/atoms/layout/Modal';
import EmptyHint from '@/ui/dirk/EmptyHint';
import FilterChip from '@/ui/dirk/FilterChip';
import GroupBlock from '@/ui/dirk/GroupBlock';
import HoverActions from '@/ui/dirk/HoverActions';
import ModuleShell from '@/ui/dirk/ModuleShell';
import PageHeading from '@/ui/dirk/PageHeading';
import Topbar from '@/ui/dirk/Topbar';

import {
  GoalsProvider,
  useGoalsActions,
  useGoalsData,
  useGoalsFilters,
} from './context';
import CarryOverDialog from './components/CarryOverDialog';
import SideColumn from './components/SideColumn';
import { STATUS_LABEL, STATUS_TONE } from './lib/constants';
import { formatDate } from './lib/date-format';
import type {
  CanonicalStatus,
  GoalEntry,
  LoadState,
} from './lib/types';

/**
 * Goals — Direction K · Sauge.
 *
 * Single detail view (no more Form/History tabs). Sticky topbar
 * + page header + 2-column body: main = goals grouped by thread
 * (or year), side = filters and stats. Each row carries an inline
 * status pill (click to cycle open → wip → done → open) and a
 * trash affordance.
 *
 * Create / edit lifecycle: the "+ Nouvel objectif" CTA opens the
 * global Composer with `type='goal'`. The Composer's `goal` body
 * is currently a single textarea — a richer form (title + date +
 * status + thread + note) and an edit-prefill flow are tracked
 * for follow-up. For now this page is a faithful list with status
 * + delete inline; new entries flow through the Composer.
 */

export default function GoalsPage() {
  return (
    <GoalsProvider>
      <GoalsView />
    </GoalsProvider>
  );
}

/** Page rendering surface — reads from the three Goals contexts and
 *  feeds the existing prop-driven sub-components. Subsequent commits
 *  will migrate the leaves (`SideColumn`, `PrimaryColumn`,
 *  `CarryOverDialog`, `GoalRow`) to consume the contexts directly,
 *  eliminating most of this prop plumbing. */
function GoalsView() {
  const setMobileMenuOpen = useNodeaStore((s) => s.setMobileMenuOpen);
  const openComposer = useNodeaStore((s) => s.openComposer);

  const { load, stats } = useGoalsData();
  const { groups } = useGoalsFilters();
  const { cycleStatus, editEntry, deleteEntry } = useGoalsActions();

  return (
    <ModuleShell
      topbar={
        <Topbar
          label={`Goals · ${stats.total} ${stats.total === 1 ? 'objectif' : 'objectifs'}`}
          onOpenMenu={() => setMobileMenuOpen(true)}
        >
          <Button variant="primary" size="sm" onClick={() => openComposer('goal')}>
            + Nouvel objectif
          </Button>
        </Topbar>
      }
      side={<SideColumn />}
    >
      <PrimaryColumn
        load={load}
        stats={stats}
        groups={groups}
        onToggleStatus={cycleStatus}
        onDelete={deleteEntry}
        onEdit={editEntry}
      />
      <CarryOverDialog />
    </ModuleShell>
  );
}

interface PrimaryColumnProps {
  load: LoadState;
  stats: { total: number; open: number; wip: number; done: number };
  groups: ReadonlyArray<readonly [string, GoalEntry[]]>;
  onToggleStatus: (entry: GoalEntry) => void | Promise<void>;
  onDelete: (entry: GoalEntry) => void | Promise<void>;
  onEdit: (entry: GoalEntry) => void;
}

function PrimaryColumn({
  load,
  stats,
  groups,
  onToggleStatus,
  onDelete,
  onEdit,
}: PrimaryColumnProps) {
  return (
    <section className="flex min-w-0 flex-col">
      <PageHeading>Goals</PageHeading>

      {load.status === 'error' ? (
        <p
          role="alert"
          className="mb-4 border-l-2 border-danger bg-danger/5 px-3 py-2 text-[12px] text-danger"
        >
          {load.message}
        </p>
      ) : null}

      <div>
        {load.status === 'loading' && stats.total === 0 ? (
          <EmptyHint>Chargement des objectifs…</EmptyHint>
        ) : groups.length === 0 ? (
          <EmptyHint>Aucun objectif pour cette sélection.</EmptyHint>
        ) : (
          groups.map(([groupLabel, items]) => (
            <GroupBlock
              key={groupLabel}
              label={groupLabel}
              count={items.length}
              countNoun="objectif"
              variant="eyebrow"
            >
              {items.map((entry) => (
                <GoalRow
                  key={entry.id}
                  entry={entry}
                  onToggleStatus={() => onToggleStatus(entry)}
                  onDelete={() => onDelete(entry)}
                  onEdit={() => onEdit(entry)}
                />
              ))}
            </GroupBlock>
          ))
        )}
      </div>
    </section>
  );
}

interface GoalRowProps {
  entry: GoalEntry;
  onToggleStatus: () => void;
  onDelete: () => void;
  onEdit: () => void;
}

function GoalRow({ entry, onToggleStatus, onDelete, onEdit }: GoalRowProps) {
  return (
    <li className="group flex items-start gap-3 border-b border-hair py-3 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline gap-x-3">
          <p
            className={cn(
              'text-[14px] font-medium transition-colors',
              entry.status === 'done' ? 'text-muted line-through' : 'text-ink',
            )}
          >
            {entry.title}
          </p>
          {entry.date ? (
            <span className="text-[11px] tabular-nums text-muted">{formatDate(entry.date)}</span>
          ) : null}
        </div>
        {entry.note ? (
          <p className="mt-1 text-[13px] leading-[1.5] text-ink-soft">{entry.note}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1.5">
        <StatusPill status={entry.status} onCycle={onToggleStatus} />
        <HoverActions>
          <Button
            variant="ghost"
            size="sm"
            iconOnly
            onClick={onEdit}
            aria-label="Modifier l’objectif"
            title="Modifier"
          >
            <PencilSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
          <Button
            variant="danger-ghost"
            size="sm"
            iconOnly
            onClick={onDelete}
            aria-label="Supprimer l’objectif"
            title="Supprimer"
          >
            <TrashIcon className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>
        </HoverActions>
      </div>
    </li>
  );
}

function StatusPill({
  status,
  onCycle,
}: {
  status: CanonicalStatus;
  onCycle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onCycle}
      aria-label={`Statut : ${STATUS_LABEL[status]}, cliquer pour cycler`}
      title={`Statut : ${STATUS_LABEL[status]}`}
      className={cn(
        'inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        STATUS_TONE[status],
      )}
    >
      <StatusGlyph status={status} />
      <span className="tracking-[0.01em]">{STATUS_LABEL[status]}</span>
    </button>
  );
}

function StatusGlyph({ status }: { status: CanonicalStatus }) {
  // Hand-rolled SVG glyphs — heroicons doesn't ship a half-filled
  // circle that matches the K aesthetic. 8×8, currentColor.
  if (status === 'done') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <path
          d="M1.5 4l1.6 1.6L6.5 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  if (status === 'wip') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M4 1 A3 3 0 0 1 4 7 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}

