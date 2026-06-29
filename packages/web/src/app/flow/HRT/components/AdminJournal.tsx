/**
 * HRT · AdminJournal — the filtered dose journal : a molecule + date
 * filter bar, the mg-equivalent dose chart, and the list of `AdminLogRow`.
 *
 * Owns its own filter state (molecule picker + date range) and derives
 * everything from the passed-in `entries` + product map ; the parent
 * (`AdministrationView`) keeps to orchestration (forms, recurring
 * schedules). Grouping / series are pure helpers in `lib/admin-data`.
 * The filter + chart follow the MOLECULE, not the product.
 */
import { useMemo, useState } from 'react';

import type { HrtProductPayload } from '@nodea/shared';
import { useNodeaStore } from '@/core/store/nodea-store';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Select from '@/ui/atoms/dirk/Select';
import VirtualWindowList from '@/ui/atoms/layout/VirtualWindowList';

import { buildDoseSeries, distinctMolecules, moleculeOf } from '../lib/admin-data';
import {
  clampDateRangePreset,
  EMPTY_RANGE,
  inDateRange,
  type DateRange,
} from '../lib/date-range';
import { todayIso } from '../lib/labels';
import type { AdminLogEntry } from '../hooks/use-admin-logs';
import AdminLogRow from './AdminLogRow';
import CollapseToggle from '@/ui/dirk/module/CollapseToggle';
import DateRangeFilter from './DateRangeFilter';
import LabChart from './LabChart';

interface AdminJournalProps {
  entries: ReadonlyArray<AdminLogEntry>;
  productByName: ReadonlyMap<string, HrtProductPayload>;
  onEditEntry: (entry: AdminLogEntry) => void;
  onDeleteEntry: (entry: AdminLogEntry) => void;
}

export default function AdminJournal({
  entries,
  productByName,
  onEditEntry,
  onDeleteEntry,
}: AdminJournalProps) {
  const { t } = useI18n();
  const [chartSel, setChartSel] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<DateRange>(EMPTY_RANGE);
  const [chartOpen, setChartOpen] = useState(true);
  // Default time window — seeded from the encrypted `hrtDefaultDateRange` pref
  // (read once at mount, clamped). DateRangeFilter seeds its Select to this and
  // emits the resolved range on mount ; the Select still overrides per session.
  const [initialPreset] = useState(() =>
    clampDateRangePreset(useNodeaStore.getState().preferences.hrtDefaultDateRange),
  );

  // Molecule options stay computed from all entries (the date filter
  // shouldn't make the picker flicker). A specific molecule narrows the
  // list + charts it ; « Toutes » shows every dose and hides the chart.
  const molecules = useMemo(
    () => distinctMolecules(entries, productByName),
    [entries, productByName],
  );
  const filterMolecule =
    chartSel && molecules.some((m) => m.name === chartSel) ? chartSel : null;
  const chartMolecule =
    filterMolecule ?? (molecules.length === 1 ? (molecules[0]?.name ?? null) : null);

  const dateFiltered = useMemo(
    () => entries.filter((e) => inDateRange(e.payload.date, dateRange)),
    [entries, dateRange],
  );
  // Make the chart's time axis span the filtered window (not just the
  // data extent), so the date filter visibly reshapes the chart.
  const domain =
    dateRange.from || dateRange.to
      ? { from: dateRange.from, to: dateRange.to || todayIso() }
      : undefined;
  const series = useMemo(
    () =>
      chartMolecule
        ? buildDoseSeries(dateFiltered, chartMolecule, productByName)
        : { points: [], skipped: 0 },
    [dateFiltered, chartMolecule, productByName],
  );
  const listEntries = filterMolecule
    ? dateFiltered.filter((e) => moleculeOf(e, productByName) === filterMolecule)
    : dateFiltered;
  const showChart =
    (molecules.length === 1 || filterMolecule != null) &&
    chartMolecule != null &&
    series.points.length > 0;

  return (
    <>
      {/* Filter bar + chart pin below the topbar while the list scrolls ;
          the chart folds away via the toggle to reclaim space. */}
      <div className="sticky top-13 z-10 bg-bg pb-3">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {molecules.length > 1 ? (
            <Select
              aria-label={t('hrt.administration.moleculeFilterAria')}
              borderless
              className="w-auto"
              value={chartSel ?? ''}
              onChange={(e) => setChartSel(e.target.value === '' ? null : e.target.value)}
            >
              <option value="">{t('hrt.administration.allMolecules')}</option>
              {molecules.map((m) => (
                <option key={m.name} value={m.name}>
                  {m.name} ({m.count})
                </option>
              ))}
            </Select>
          ) : null}
          <DateRangeFilter onChange={setDateRange} initialPreset={initialPreset} />
          {showChart ? (
            <CollapseToggle
              open={chartOpen}
              onToggle={() => setChartOpen((o) => !o)}
              label={chartOpen ? t('hrt.chart.hide') : t('hrt.chart.show')}
              className="ml-auto"
            />
          ) : null}
        </div>
        {showChart && chartMolecule ? (
          <div
            className={cn(
              'grid transition-[grid-template-rows] duration-300 ease-out',
              chartOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]',
            )}
          >
            <div className="overflow-hidden">
              <LabChart
                points={series.points}
                unit="mg"
                label={chartMolecule}
                {...(domain ? { domain } : {})}
              />
            </div>
          </div>
        ) : null}
      </div>
      <div className="flex flex-col">
        <VirtualWindowList
          items={listEntries}
          estimateRowHeight={68}
          getKey={(e) => e.id}
          renderItem={(entry) => (
            <AdminLogRow
              entry={entry}
              product={productByName.get(entry.payload.product)}
              onEdit={() => onEditEntry(entry)}
              onDelete={() => onDeleteEntry(entry)}
            />
          )}
        />
      </div>
    </>
  );
}
