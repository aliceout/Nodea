/**
 * HRT · Export — one titled card of checkboxes (Administration molecules
 * or Analyses markers).
 *
 * Multi-select via native checkboxes (checked = included in the report).
 * Inclusion is tracked by the caller as an « excluded » Set (empty = all
 * shown) so the default needs no async init once options load. « Tout » /
 * « Aucun » flip the whole card. On-screen control only — it lives outside
 * the printable area, so it never reaches the page. Renders an empty hint
 * rather than collapsing, so the two-card grid stays stable.
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';

export interface FilterOption {
  value: string;
  label: string;
  count?: number;
}

export interface FilterColumnModel {
  options: ReadonlyArray<FilterOption>;
  /** Values to hide. Empty = all shown (the default). */
  excluded: ReadonlySet<string>;
  onToggle: (value: string) => void;
  onAll: () => void;
  onNone: () => void;
}

interface ExportFilterColumnProps extends FilterColumnModel {
  title: string;
}

export default function ExportFilterColumn({
  title,
  options,
  excluded,
  onToggle,
  onAll,
  onNone,
}: ExportFilterColumnProps) {
  const { t } = useI18n();
  return (
    <div role="group" aria-label={title} className="min-w-0 rounded-lg border border-hair p-5">
      <div className="mb-3 flex items-center justify-between gap-2 border-b border-hair pb-2.5">
        <span className="text-[13px] font-semibold text-ink">{title}</span>
        {options.length > 0 ? (
          <span className="flex items-center gap-2">
            <button type="button" onClick={onAll} className="text-[11px] text-accent hover:underline">
              {t('hrt.export.filter.all')}
            </button>
            <span aria-hidden="true" className="text-[11px] text-muted-soft">·</span>
            <button type="button" onClick={onNone} className="text-[11px] text-muted hover:underline">
              {t('hrt.export.filter.none')}
            </button>
          </span>
        ) : null}
      </div>

      {options.length === 0 ? (
        <p className="text-[12px] text-muted-soft">{t('hrt.export.filter.empty')}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-hair">
          {options.map((o) => (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2.5 py-2.5 text-[13px] text-ink transition-colors hover:bg-bg-2">
                <input
                  type="checkbox"
                  className="h-4 w-4 shrink-0 cursor-pointer accent-accent"
                  checked={!excluded.has(o.value)}
                  onChange={() => onToggle(o.value)}
                />
                <span className="min-w-0 truncate">{o.label}</span>
                {o.count !== undefined ? (
                  <span className="ml-auto shrink-0 text-[12px] tabular-nums text-muted">{o.count}</span>
                ) : null}
              </label>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
