/**
 * HRT · ProductRow — one entry in the product catalog. Shows the product
 * name + concentration, then molecule / category / route / unit, plus
 * optional notes.
 *
 * Pure presentation. Active products get edit + **archive** (never a hard
 * delete — archiving keeps past doses' join intact and lets the product
 * be reused) ; an archived product gets a single **Réactiver** action.
 * The parent decides which callbacks to pass.
 */
import { ArchiveBoxArrowDownIcon, PencilSquareIcon } from '@heroicons/react/24/outline';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import Button from '@/ui/atoms/dirk/Button';
import HoverActions from '@/ui/dirk/module/HoverActions';

import { categoryLabel, routeLabel } from '../lib/labels';
import type { ProductEntry } from '../hooks/use-products';

interface ProductRowProps {
  entry: ProductEntry;
  onEdit?: () => void;
  /** Active product → move to the archive. */
  onArchive?: () => void;
  /** Archived product → bring it back to the active catalog. */
  onReactivate?: () => void;
}

export default function ProductRow({ entry, onEdit, onArchive, onReactivate }: ProductRowProps) {
  const { t } = useI18n();
  return (
    <li className="group flex items-start gap-2 border-b border-hair py-3">
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
          {categoryLabel(t, entry.payload.category)} · {routeLabel(t, entry.payload.route)} ·{' '}
          {entry.payload.unit}
        </p>
        {entry.payload.notes ? (
          <p className="mt-0.5 text-[12px] text-muted-soft">{entry.payload.notes}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {onReactivate ? (
          <Button variant="secondary" size="sm" onClick={onReactivate}>
            {t('hrt.product.reactivate')}
          </Button>
        ) : (
          <HoverActions className="gap-1">
            {onEdit ? (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={t('common.actions.edit')}
                onClick={onEdit}
              >
                <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
            {onArchive ? (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                aria-label={t('hrt.product.archiveAria')}
                onClick={onArchive}
              >
                <ArchiveBoxArrowDownIcon className="h-4 w-4" aria-hidden="true" />
              </Button>
            ) : null}
          </HoverActions>
        )}
      </div>
    </li>
  );
}
