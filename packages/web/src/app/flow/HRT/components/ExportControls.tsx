/**
 * HRT · Export — the export configurator : the « Période » date menu, the
 * « Grouper par » toggle, the ephemeral intitulé, and the two « what to
 * include » filter cards.
 *
 * Centred + width-capped (`max-w-5xl`). A spacious config row over two
 * filter **cards** : **Administration** (molecules, which scope the regimen
 * + dose tables + dose charts) and **Analyses** (markers, which scope the
 * analyses tables + marker charts). The intitulé goes in the PDF header but
 * is never persisted. The download **actions live up by the view's heading**
 * (see `ExportView`), not here — so this reads as a set of inputs, not a
 * button bar.
 */
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
}

export default function ExportControls({
  onRangeChange,
  groupBy,
  onGroupByChange,
  molecules,
  markers,
  note,
  onNoteChange,
}: ExportControlsProps) {
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      {/* Configuration : période + grouping + ephemeral label. */}
      <div className="flex flex-wrap items-end gap-x-8 gap-y-4">
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

      {/* Two filter cards : what to include in the document. */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <ExportFilterColumn title="Administration" {...molecules} />
        <ExportFilterColumn title="Analyses" {...markers} />
      </div>
    </div>
  );
}
