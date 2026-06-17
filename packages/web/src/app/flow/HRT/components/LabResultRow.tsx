/**
 * HRT · LabResultRow — one lab result in the Analyses list. Shows the
 * marker label, the raw value + stored unit, the draw context and lab,
 * plus optional notes.
 *
 * Pure presentation : the marker filter, unit conversion and chart live
 * in the parent view ; this file owns a single row's layout only. The
 * stored unit is shown verbatim (not the chart's display unit) so the
 * list always reflects what was actually entered.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';

import { drawContextLabel, formatLogDate, markerLabel } from '../lib/labels';
import RowActions from './RowActions';
import type { LabResultEntry } from '../hooks/use-lab-results';

interface LabResultRowProps {
  entry: LabResultEntry;
  /** Hover actions — omit both for a read-only row (e.g. the Summary
   *  dashboard, where editing happens in the Analyses view). */
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function LabResultRow({ entry, onEdit, onDelete }: LabResultRowProps) {
  const { t, language } = useI18n();
  const hasContext = entry.payload.context !== 'unknown';

  return (
    <li className="group flex items-start gap-2 border-b border-hair py-3">
      <span className="w-[112px] shrink-0 text-[12px] tabular-nums text-muted">
        {formatLogDate(entry.payload.date, language)}
      </span>
      <div className="min-w-0 flex-1">
        {/* Wraps on mobile (full entry visible) ; single-line ellipsis
            from md+ — same posture as AdminLogRow. */}
        <p className="text-[13.5px] font-medium text-ink md:truncate">
          {markerLabel(entry.payload.marker)}
          <span className="ml-2 font-normal text-muted tabular-nums">
            {entry.payload.value} {entry.payload.unit}
          </span>
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {hasContext ? drawContextLabel(t, entry.payload.context) : null}
          {hasContext && entry.payload.lab ? ' · ' : ''}
          {entry.payload.lab}
        </p>
        {entry.payload.notes ? (
          <p className="mt-0.5 text-[12px] text-muted-soft">{entry.payload.notes}</p>
        ) : null}
      </div>
      {onEdit && onDelete ? <RowActions onEdit={onEdit} onDelete={onDelete} /> : null}
    </li>
  );
}
