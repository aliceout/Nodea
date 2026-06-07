/**
 * HRT · Products — manage the product catalog.
 *
 * A small CRUD over the product collection (`hrt-suppliers` wire name).
 * Each product holds molecule / category / route / dose unit and an
 * optional concentration. Registering products here is what makes them
 * pickable in the Administration dose form — which is catalog-only.
 */
import { useState } from 'react';

import type { HrtProductPayload } from '@nodea/shared';
import Button from '@/ui/atoms/dirk/Button';

import ProductForm from '../components/ProductForm';
import ProductRow from '../components/ProductRow';
import { useHrtProducts, type ProductEntry } from '../hooks/use-products';

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

      <div className="mb-4 space-y-0.5 text-[12px] text-muted">
        <p>
          Enregistre tes produits (molécule, voie, unité, et concentration mg/mL
          pour les injectables).
        </p>
        <p>
          Tu les retrouveras dans le menu d’une prise — une dose en mL sera
          convertie en mg automatiquement.
        </p>
      </div>

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
            <ProductRow
              key={entry.id}
              entry={entry}
              onEdit={() => {
                setAdding(false);
                setEditing(entry);
              }}
              onDelete={() => void onDelete(entry)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
