/**
 * HRT · Import — the dry-run review for an uploaded analyses file.
 *
 * Presentational : how many rows are valid / ignored, a per-marker mapping
 * (each distinct imported marker -> a Nodea preset, or kept custom), the
 * ignored-row reasons, and the import trigger. The parent (`ImportPanel`)
 * owns the parse, the mapping state and the bulk create ; this only renders
 * the decision surface.
 */
import { HRT_MARKERS } from '@nodea/shared';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import Select from '@/ui/atoms/dirk/Select';

import type { RowError } from '../lib/import-model';

interface ImportReviewProps {
  validCount: number;
  errors: readonly RowError[];
  /** Distinct imported marker strings to reconcile. */
  markers: readonly string[];
  /** Imported marker -> chosen value (preset key, or the verbatim string). */
  mapping: ReadonlyMap<string, string>;
  onMap: (marker: string, value: string) => void;
  onImport: () => void;
  importing: boolean;
  progress: number;
}

export default function ImportReview({
  validCount,
  errors,
  markers,
  mapping,
  onMap,
  onImport,
  importing,
  progress,
}: ImportReviewProps) {
  const { t, tn } = useI18n();
  return (
    <div className="mt-5 rounded-lg border border-hair p-4">
      <p className="text-[13px] text-ink">
        <span className="font-semibold">{validCount}</span>{' '}
        {tn('hrt.import.review.ready', validCount)}
        {errors.length > 0 && (
          <span className="text-muted">
            {' · '}
            {tn('hrt.import.review.ignoredRows', errors.length)}
          </span>
        )}
      </p>

      {markers.length > 0 && (
        <div className="mt-4">
          <p className="mb-2 text-[12px] font-semibold tracking-[0.02em] text-muted">
            {t('hrt.import.review.mapMarkers')}
          </p>
          <ul className="flex flex-col gap-2">
            {markers.map((marker) => (
              <li key={marker} className="flex flex-wrap items-center gap-2">
                <span className="min-w-[10rem] flex-1 truncate text-[13px] text-ink">{marker}</span>
                <span aria-hidden="true" className="text-muted">→</span>
                <Select
                  className="w-auto"
                  aria-label={t('hrt.import.review.markerSelectAria', { values: { marker } })}
                  value={mapping.get(marker) ?? marker}
                  onChange={(e) => onMap(marker, e.target.value)}
                >
                  <option value={marker}>
                    {t('hrt.import.review.keepMarker', { values: { marker } })}
                  </option>
                  {HRT_MARKERS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </div>
      )}

      {errors.length > 0 && (
        <details className="mt-4">
          <summary className="cursor-pointer text-[12px] text-muted">
            {t('hrt.import.review.showIgnored')}
          </summary>
          <ul className="mt-2 flex flex-col gap-1">
            {errors.map((e) => (
              <li key={e.row} className="text-[12px] text-muted">
                {t('hrt.import.review.lineReason', { values: { row: e.row, reason: e.reason } })}
              </li>
            ))}
          </ul>
        </details>
      )}

      <div className="mt-4 flex items-center gap-3">
        <Button
          variant="primary"
          size="sm"
          onClick={onImport}
          disabled={importing || validCount === 0}
        >
          {importing
            ? t('hrt.import.review.importing')
            : tn('hrt.import.review.importButton', validCount)}
        </Button>
        {importing && (
          <span className="text-[12px] text-muted" role="status">
            {tn('hrt.import.review.progress', progress)}
          </span>
        )}
      </div>
    </div>
  );
}
