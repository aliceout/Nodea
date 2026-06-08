/**
 * HRT · Export — the export page's toolbar (the whole page is this : the
 * recap is generated as a downloadable PDF on demand, not rendered).
 *
 * Centred + width-capped (`max-w-5xl`) so it reads as a deliberate
 * configurator. A top line — the date menu (« Période »), the « Grouper
 * par » toggle and the ephemeral intitulé, with three downloads (PDF recap,
 * CSV doses, CSV analyses) on the right — over two filter **cards** :
 * **Administration** (molecules, which scope the regimen + dose tables +
 * dose charts) and **Analyses** (markers, which scope the analyses tables +
 * marker charts). The intitulé goes in the PDF header but is never
 * persisted. The PDF button shows a generating state + disables until the
 * data is ready ; CSV buttons disable when their collection is empty.
 */
import { ArrowDownTrayIcon } from '@heroicons/react/24/outline';

import Button from '@/ui/atoms/dirk/Button';
import Input from '@/ui/atoms/dirk/Input';
import Select from '@/ui/atoms/dirk/Select';

import type { DateRange } from '../lib/date-range';
import type { ExportGroupBy } from '../lib/export-model';
import DateRangeFilter from './DateRangeFilter';
import ExportFilterColumn, { type FilterColumnModel } from './ExportFilterColumn';

interface ExportControlsProps {
  onRangeChange: (range: DateRange) => void;
  groupBy: ExportGroupBy;
  onGroupByChange: (value: ExportGroupBy) => void;
  molecules: FilterColumnModel;
  markers: FilterColumnModel;
  note: string;
  onNoteChange: (value: string) => void;
  onDownloadPdf: () => void;
  /** PDF generation in flight — disables the button + shows « Génération… ». */
  generating: boolean;
  /** Data loaded — the PDF button is disabled until then. */
  ready: boolean;
  onExportDoses: () => void;
  onExportLabs: () => void;
  doseCount: number;
  labCount: number;
}

export default function ExportControls({
  onRangeChange,
  groupBy,
  onGroupByChange,
  molecules,
  markers,
  note,
  onNoteChange,
  onDownloadPdf,
  generating,
  ready,
  onExportDoses,
  onExportLabs,
  doseCount,
  labCount,
}: ExportControlsProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-7">
      {/* Top line : période + intitulé on the left, actions on the right. */}
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-1 flex-wrap items-end gap-x-6 gap-y-4">
          <div>
            <span className="mb-1.5 block text-[12px] font-semibold tracking-[0.02em] text-muted">
              Période
            </span>
            <DateRangeFilter onChange={onRangeChange} />
          </div>
          <div>
            <label
              htmlFor="hrt-export-groupby"
              className="mb-1.5 block text-[12px] font-semibold tracking-[0.02em] text-muted"
            >
              Grouper par
            </label>
            <Select
              id="hrt-export-groupby"
              borderless
              className="w-auto"
              value={groupBy}
              onChange={(e) => onGroupByChange(e.target.value as ExportGroupBy)}
            >
              <option value="type">Molécule / marqueur</option>
              <option value="date">Date</option>
            </Select>
          </div>
          <div className="min-w-[16rem] flex-1">
            <label
              htmlFor="hrt-export-note"
              className="mb-1.5 block text-[12px] font-semibold tracking-[0.02em] text-muted"
            >
              Intitulé (optionnel)
            </label>
            <Input
              id="hrt-export-note"
              type="text"
              placeholder="ex. prénom, n° de dossier — figure sur l’impression, jamais enregistré"
              value={note}
              maxLength={120}
              onChange={(e) => onNoteChange(e.target.value)}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={onDownloadPdf}
            disabled={!ready || generating}
          >
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            {generating ? 'Génération…' : 'Télécharger le PDF'}
          </Button>
          <Button variant="neutral" size="sm" onClick={onExportDoses} disabled={doseCount === 0}>
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            CSV prises
          </Button>
          <Button variant="neutral" size="sm" onClick={onExportLabs} disabled={labCount === 0}>
            <ArrowDownTrayIcon className="h-4 w-4" aria-hidden="true" />
            CSV analyses
          </Button>
        </div>
      </div>

      {/* Two filter cards : what to include in the document. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ExportFilterColumn title="Administration" {...molecules} />
        <ExportFilterColumn title="Analyses" {...markers} />
      </div>
    </div>
  );
}
