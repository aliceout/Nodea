/**
 * HRT · Products — manage the product catalog.
 *
 * A small CRUD over the product collection (`hrt-suppliers` wire name).
 * Each product holds molecule / category / route / dose unit and an
 * optional concentration. Registering products here is what makes them
 * pickable in the Administration dose form — which is catalog-only.
 */
import { useState } from 'react';
import { PencilSquareIcon, TrashIcon } from '@heroicons/react/24/outline';

import type { HrtProductPayload } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';

import ProductForm from '../components/ProductForm';
import { useHrtProducts, type ProductEntry } from '../data/use-products';
import { HRT_CATEGORY_LABELS, HRT_ROUTE_LABELS } from '../lib/labels';

export default function ProductsView() {
  const { entries, load, ready, create, update, remove } = useHrtProducts();
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<ProductEntry | null>(null);

  const formOpen = adding || editing !== null;

  function closeForm() {
    setAdding(false);
    setEditing(null);
  }

  async function onSubmit(payload: HrtProductPayload, id?: string): Promise<void> {
    if (id) await update(id, payload);
    else await create(payload);
  }

  async function onDelete(entry: ProductEntry): Promise<void> {
    if (!window.confirm(`Supprimer le produit « ${entry.payload.name} » ?`)) return;
    await remove(entry.id);
  }

  return (
    <section className="min-w-0">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-[14px] font-medium text-ink">Produits</h2>
        {!formOpen ? (
          <Button variant="primary" size="sm" onClick={() => setAdding(true)} disabled={!ready}>
            + Nouveau produit
          </Button>
        ) : null}
      </div>

      <p className="mb-4 max-w-prose text-[12px] text-muted">
        Enregistre tes produits (molécule, voie, unité, et concentration
        mg/mL pour les injectables). Tu les retrouveras dans le menu d’une
        prise — une dose en mL sera convertie en mg automatiquement.
      </p>

      {formOpen ? (
        <div className="mb-5">
          <ProductForm
            {...(editing ? { initial: editing } : {})}
            onSubmit={onSubmit}
            onClose={closeForm}
          />
        </div>
      ) : null}

      {load.status === 'loading' ? (
        <p className="py-8 text-center text-[13px] text-muted">Chargement…</p>
      ) : load.status === 'error' ? (
        <p className="py-8 text-center text-[13px] text-danger">{load.message}</p>
      ) : entries.length === 0 && !formOpen ? (
        <div className="rounded-md border border-dashed border-hair bg-bg-2 p-8 text-center">
          <p className="text-[13px] text-muted">
            Aucun produit enregistré. Ajoute le premier avec « + Nouveau
            produit ».
          </p>
        </div>
      ) : (
        <ul className="flex flex-col">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="group flex items-start gap-4 border-b border-hair py-3"
            >
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
                  {HRT_CATEGORY_LABELS[entry.payload.category]} ·{' '}
                  {HRT_ROUTE_LABELS[entry.payload.route]} · {entry.payload.unit}
                </p>
                {entry.payload.notes ? (
                  <p className="mt-0.5 text-[12px] text-muted-soft">{entry.payload.notes}</p>
                ) : null}
              </div>

              <div className="flex shrink-0 gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="sm"
                  iconOnly
                  aria-label="Modifier"
                  onClick={() => {
                    setAdding(false);
                    setEditing(entry);
                  }}
                >
                  <PencilSquareIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
                <Button
                  variant="danger-ghost"
                  size="sm"
                  iconOnly
                  aria-label="Supprimer"
                  onClick={() => void onDelete(entry)}
                >
                  <TrashIcon className="h-4 w-4" aria-hidden="true" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
