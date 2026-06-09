/**
 * HRT · Export — doctor recap, downloaded as a PDF (orchestration).
 *
 * The module's fourth sub-view. Reads all four HRT collections (products
 * for the join, admin logs, lab results, schedules), lets the user scope a
 * date range, group by molecule/marker or date, pick which molecules /
 * markers to include (checkbox columns) and type an ephemeral intitulé.
 * Recurring-schedule occurrences are already materialised at module mount
 * (see `index.tsx`), so the dose history includes the auto-generated days.
 *
 * Selection is tracked as « excluded » Sets (empty = all shown) so the
 * default needs no async init. The molecule selection scopes the regimen +
 * dose tables + dose charts ; the marker selection scopes the analyses
 * tables + marker charts. Every derivation is a pure `export-model` builder.
 * The recap isn't rendered on screen — « Télécharger le PDF » generates it
 * client-side via `lib/export-pdf` (jsPDF, lazy-loaded ; the recap is
 * decrypted health data, so no server render is possible), and the two data
 * downloads write the same (filtered) rows to Excel `.xlsx` or LibreOffice
 * `.ods` via `lib/spreadsheet`. See `docs/Modules/HRT.md`.
 */
import { useMemo, useState } from 'react';
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import type { HrtProductPayload } from '@nodea/shared';

import { errorMessageOf } from '@/core/types/load-state';
import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';

import DedupPanel from '../components/DedupPanel';
import ExportControls from '../components/ExportControls';
import type { FilterOption } from '../components/ExportFilterColumn';
import ExportMenuButton from '../components/ExportMenuButton';
import ImportPanel from '../components/ImportPanel';
import type { UseHrtAdminLogs } from '../hooks/use-admin-logs';
import { useHrtLabResults } from '../hooks/use-lab-results';
import { useHrtProducts } from '../hooks/use-products';
import { useHrtSchedules } from '../hooks/use-schedules';
import { distinctMolecules } from '../lib/admin-data';
import { distinctMarkers } from '../lib/chart-data';
import { EMPTY_RANGE, type DateRange } from '../lib/date-range';
import {
  buildDoseCharts,
  buildDoseHistory,
  buildLabGroups,
  buildRegimen,
  doseMatrix,
  labMatrix,
  type ExportGroupBy,
} from '../lib/export-model';
import { downloadExportPdf } from '../lib/export-pdf';
import { downloadSpreadsheet, type SpreadsheetFormat } from '../lib/spreadsheet';
import { formatDotDate, markerLabel, todayIso, type HrtTranslate } from '../lib/labels';

/** Human « Période : … » label for the report header. */
function periodText(range: DateRange, t: HrtTranslate): string {
  const { from, to } = range;
  if (!from && !to) return t('hrt.export.period.all');
  const values = { from: formatDotDate(from), to: formatDotDate(to) };
  if (from && to) return t('hrt.export.period.between', { values });
  if (from) return t('hrt.export.period.since', { values });
  return t('hrt.export.period.until', { values });
}

/** Immutable toggle of a value's membership in a Set. */
function toggled(set: ReadonlySet<string>, value: string): Set<string> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

interface ExportViewProps {
  /** The single shared admin-logs instance — owned by `HrtPage`
   *  (audit 2026-06 : one LIST per module mount, not per view). */
  adminLogs: UseHrtAdminLogs;
}

export default function ExportView({ adminLogs }: ExportViewProps) {
  const { t, tn, language } = useI18n();
  const products = useHrtProducts();
  const admin = adminLogs;
  const labResults = useHrtLabResults();
  const schedules = useHrtSchedules();

  const [range, setRange] = useState<DateRange>(EMPTY_RANGE);
  const [note, setNote] = useState('');
  // Group the tables by molecule/marker `type` (default — easier to read
  // than every substance mixed by date) or flat by `date`.
  const [groupBy, setGroupBy] = useState<ExportGroupBy>('type');
  // Excluded = hidden ; empty Set = everything shown (the default).
  const [excludedMolecules, setExcludedMolecules] = useState<ReadonlySet<string>>(new Set());
  const [excludedMarkers, setExcludedMarkers] = useState<ReadonlySet<string>>(new Set());
  // PDF generation is async (the jsPDF lib loads on demand) — gate the button.
  const [generating, setGenerating] = useState(false);

  // Join key over ALL products (incl. archived) so past doses keep their
  // molecule / unit display, like the other HRT views.
  const productByName = useMemo(() => {
    const m = new Map<string, HrtProductPayload>();
    for (const p of products.entries) m.set(p.payload.name, p.payload);
    return m;
  }, [products.entries]);

  // Selector options come from ALL entries ever logged (« sont ou ont été
  // administré »), not the date-filtered set — so every molecule / marker
  // stays togglable regardless of the current range.
  const moleculeOptions = useMemo<FilterOption[]>(
    () =>
      distinctMolecules(admin.entries, productByName).map((m) => ({
        value: m.name,
        label: m.name,
        count: m.count,
      })),
    [admin.entries, productByName],
  );
  const markerOptions = useMemo<FilterOption[]>(
    () =>
      distinctMarkers(labResults.entries).map((m) => ({
        value: m.key,
        label: markerLabel(m.key),
        count: m.count,
      })),
    [labResults.entries],
  );

  const regimen = useMemo(
    () =>
      buildRegimen(schedules.entries, productByName, t).filter(
        (r) => !excludedMolecules.has(r.molecule),
      ),
    [schedules.entries, productByName, excludedMolecules, t],
  );
  const doses = useMemo(
    () =>
      buildDoseHistory(admin.entries, productByName, range, t).filter(
        (d) => !excludedMolecules.has(d.molecule),
      ),
    [admin.entries, productByName, range, excludedMolecules, t],
  );
  const labGroups = useMemo(
    () => buildLabGroups(labResults.entries, range, t).filter((g) => !excludedMarkers.has(g.key)),
    [labResults.entries, range, excludedMarkers, t],
  );
  const doseCharts = useMemo(
    () =>
      buildDoseCharts(admin.entries, productByName, range).filter(
        (c) => !excludedMolecules.has(c.molecule),
      ),
    [admin.entries, productByName, range, excludedMolecules],
  );
  const labReadingCount = labGroups.reduce((n, g) => n + g.readings.length, 0);

  const loads = [products.load, admin.load, labResults.load, schedules.load];
  const allReady = loads.every((l) => l.status === 'ready');
  const errorMessage = loads.map(errorMessageOf).find((m) => m !== null) ?? null;

  function exportDoses(format: SpreadsheetFormat): void {
    void downloadSpreadsheet(
      `nodea_hrt_prises_${todayIso()}`,
      t('hrt.export.sheets.doses'),
      doseMatrix(doses, t),
      format,
    );
  }
  function exportLabs(format: SpreadsheetFormat): void {
    void downloadSpreadsheet(
      `nodea_hrt_analyses_${todayIso()}`,
      t('hrt.export.sheets.labs'),
      labMatrix(labGroups, t),
      format,
    );
  }

  async function downloadPdf(): Promise<void> {
    setGenerating(true);
    try {
      await downloadExportPdf({
        generatedLabel: formatDotDate(todayIso()),
        periodLabel: periodText(range, t),
        note,
        groupBy,
        regimen,
        doses,
        labs: labGroups,
        doseCharts,
        filename: `nodea_hrt_recap_${todayIso()}.pdf`,
        t,
        tn,
        locale: language,
      });
    } catch (err) {
      if (import.meta.env.DEV) console.error('hrt: pdf export failed', err);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <section className="min-w-0">
      <div className="mx-auto mb-6 max-w-5xl">
        <h2 className="text-[14px] font-medium text-ink">{t('hrt.export.title')}</h2>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-muted">
          {t('hrt.export.description')}
        </p>
      </div>

      <ExportControls
        onRangeChange={setRange}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        molecules={{
          options: moleculeOptions,
          excluded: excludedMolecules,
          onToggle: (v) => setExcludedMolecules((prev) => toggled(prev, v)),
          onAll: () => setExcludedMolecules(new Set()),
          onNone: () => setExcludedMolecules(new Set(moleculeOptions.map((o) => o.value))),
        }}
        markers={{
          options: markerOptions,
          excluded: excludedMarkers,
          onToggle: (v) => setExcludedMarkers((prev) => toggled(prev, v)),
          onAll: () => setExcludedMarkers(new Set()),
          onNone: () => setExcludedMarkers(new Set(markerOptions.map((o) => o.value))),
        }}
        note={note}
        onNoteChange={setNote}
      />

      <div className="mx-auto mt-5 flex max-w-5xl flex-wrap items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={() => void downloadPdf()}
          disabled={!allReady || generating}
        >
          <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
          {generating ? t('hrt.export.actions.generating') : t('hrt.export.actions.pdf')}
        </Button>
        <ExportMenuButton
          label={t('hrt.export.actions.doses')}
          disabled={doses.length === 0}
          onSelect={exportDoses}
        />
        <ExportMenuButton
          label={t('hrt.export.actions.labs')}
          disabled={labReadingCount === 0}
          onSelect={exportLabs}
        />
      </div>

      {errorMessage ? (
        <p className="py-8 text-center text-[13px] text-danger">{errorMessage}</p>
      ) : !allReady ? (
        <p className="py-8 text-center text-[13px] text-muted">{t('common.states.loading')}</p>
      ) : null}

      <ImportPanel />

      <DedupPanel />
    </section>
  );
}
