/**
 * HRT · AdminLogRow — one dose/injection entry in the Administration
 * journal. Joins the log to its product (passed in) to show molecule /
 * category / route / concentration and the mg-equivalent of a mL dose.
 *
 * Pure presentation : grouping, filtering and the chart live in the
 * parent view ; this file owns a single row's layout only. The product
 * may be missing (deleted from the catalog after the dose was logged) —
 * the row degrades to the stored product name + a « supprimé » hint.
 *
 * Root element is `<article>`, not `<li>` : the journal list is
 * virtualized (issue #128) through `VirtualWindowList`, whose
 * absolute-positioned wrappers can't host valid `<li>` children.
 * `<article>` keeps the row independently meaningful for assistive
 * tech without the list semantics that the virtualizer breaks.
 *
 * Wrapped in `React.memo` so sibling-row mutations (delete, edit)
 * only re-render the row whose `entry` reference moved. Combined
 * with the virtualizer above, scrolling stays smooth at ≥ 1000
 * dose entries.
 */
import { memo } from 'react';
import type { HrtProductPayload } from '@nodea/shared';

import { HRT_CATEGORY_LABELS, HRT_ROUTE_LABELS, formatLogDate } from '../lib/labels';
import { doseUnitOf, mgEquivalent } from '../lib/export-model';
import RowActions from './RowActions';
import type { AdminLogEntry } from '../hooks/use-admin-logs';

interface AdminLogRowProps {
  entry: AdminLogEntry;
  product: HrtProductPayload | undefined;
  /** Hover actions — omit both for a read-only row (e.g. the Summary
   *  dashboard, where editing happens in the Administration view). */
  onEdit?: () => void;
  onDelete?: () => void;
}

function AdminLogRowImpl({ entry, product, onEdit, onDelete }: AdminLogRowProps) {
  // A product with a mg/mL concentration is dosed in mL → derive the mg
  // here, per dose (the conversion lives at the entry, not the product).
  const unit = doseUnitOf(product);
  const mgEq = mgEquivalent(entry.payload.dose, product);

  return (
    <article className="group flex items-start gap-4 border-b border-hair py-3">
      <span className="w-[112px] shrink-0 text-[12px] tabular-nums text-muted">
        {formatLogDate(entry.payload.date)}
        {entry.payload.time ? (
          <span className="block text-[11px] text-muted-soft">{entry.payload.time}</span>
        ) : null}
        {entry.payload.scheduleId ? (
          <span className="mt-1 block w-fit rounded-sm bg-bg-2 px-1.5 py-0.5 text-[10px] font-normal text-muted">
            auto
          </span>
        ) : null}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium text-ink">
          {entry.payload.product}
          {product?.medication ? (
            <span className="font-normal"> · {product.medication}</span>
          ) : null}
          {!product ? (
            <span className="ml-1 text-[12px] font-normal text-muted">(produit supprimé)</span>
          ) : null}
          <span className="ml-2 font-normal text-muted">
            {entry.payload.dose}
            {unit ? ` ${unit}` : ''}
            {mgEq != null ? ` ≈ ${mgEq} mg` : ''}
          </span>
        </p>
        {product ? (
          <p className="mt-0.5 text-[12px] text-muted">
            <span className="text-accent">{HRT_CATEGORY_LABELS[product.category]}</span> ·{' '}
            {HRT_ROUTE_LABELS[product.route]}
            {typeof product.concentration === 'number' ? ` · ${product.concentration} mg/mL` : ''}
          </p>
        ) : null}
      </div>

      {/* Notes as a second column (not a third stacked line). Always
          rendered so the column lines up across rows. Same tone as the
          meta line for readability. */}
      <p className="min-w-0 flex-[2] text-[12px] text-muted">{entry.payload.notes}</p>

      {onEdit && onDelete ? <RowActions onEdit={onEdit} onDelete={onDelete} /> : null}
    </article>
  );
}

const AdminLogRow = memo(AdminLogRowImpl);
export default AdminLogRow;
