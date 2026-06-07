/**
 * HRT · ProductRow — one entry in the product catalog list. Shows the
 * product name + concentration, then molecule / category / route / unit
 * on a second line, plus optional notes.
 *
 * Pure presentation : the catalog CRUD lives in the parent view ; this
 * file owns a single row's layout only.
 */
import { HRT_CATEGORY_LABELS, HRT_ROUTE_LABELS } from '../lib/labels';
import RowActions from './RowActions';
import type { ProductEntry } from '../hooks/use-products';

interface ProductRowProps {
  entry: ProductEntry;
  onEdit: () => void;
  onDelete: () => void;
}

export default function ProductRow({ entry, onEdit, onDelete }: ProductRowProps) {
  return (
    <li className="group flex items-start gap-4 border-b border-hair py-3">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">
          {entry.payload.name}
          {typeof entry.payload.concentration === 'number' ? (
            <span className="ml-2 font-normal text-muted tabular-nums">
              {entry.payload.concentration} mg/mL
            </span>
          ) : null}
        </p>
        <p className="mt-0.5 text-[12px] text-muted">
          {entry.payload.medication ? `${entry.payload.medication} · ` : ''}
          {HRT_CATEGORY_LABELS[entry.payload.category]} · {HRT_ROUTE_LABELS[entry.payload.route]} ·{' '}
          {entry.payload.unit}
        </p>
        {entry.payload.notes ? (
          <p className="mt-0.5 text-[12px] text-muted-soft">{entry.payload.notes}</p>
        ) : null}
      </div>
      <RowActions onEdit={onEdit} onDelete={onDelete} />
    </li>
  );
}
