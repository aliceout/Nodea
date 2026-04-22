import { useMemo, useState } from 'react';
import { LIBRARY_STATUS_VALUES, LIBRARY_TYPE_VALUES } from '@nodea/shared';
import { useLibrary, type LibItem } from '../hooks/useLibrary';
import ItemCard from '../components/ItemCard';
import ItemDetail from '../components/ItemDetail';

export default function LibraryGridView() {
  const {
    loading,
    error,
    items,
    reviews,
    createReview,
    deleteItem,
    deleteReview,
  } = useLibrary();

  const [openId, setOpenId] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<'all' | (typeof LIBRARY_TYPE_VALUES)[number]>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof LIBRARY_STATUS_VALUES)[number]>('all');
  const [query, setQuery] = useState('');

  const visible = useMemo<LibItem[]>(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (typeFilter !== 'all' && it.payload.type !== typeFilter) return false;
      if (statusFilter !== 'all' && it.payload.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        it.payload.title,
        ...(it.payload.creators ?? []),
        ...(it.payload.tags ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [items, typeFilter, statusFilter, query]);

  const openItem = openId ? items.find((it) => it.id === openId) ?? null : null;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 py-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Ma bibliothèque</h1>
        <span className="flex-1" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher…"
          className="w-48 rounded border border-slate-300 p-2 text-sm"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as typeof typeFilter)}
          className="rounded border border-slate-300 p-2 text-sm"
        >
          <option value="all">Tous types</option>
          {LIBRARY_TYPE_VALUES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
          className="rounded border border-slate-300 p-2 text-sm"
        >
          <option value="all">Tous statuts</option>
          {LIBRARY_STATUS_VALUES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </header>

      {loading ? <p className="opacity-60">Chargement…</p> : null}
      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      {!loading && visible.length === 0 ? (
        <p className="opacity-60">Aucune œuvre ne correspond.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {visible.map((it) => (
            <ItemCard
              key={it.id}
              item={it}
              reviews={reviews}
              onOpen={() => setOpenId(it.id)}
            />
          ))}
        </div>
      )}

      {openItem ? (
        <ItemDetail
          item={openItem}
          reviews={reviews}
          onClose={() => setOpenId(null)}
          onDelete={async () => {
            await deleteItem(openItem.id);
            setOpenId(null);
          }}
          onCreateReview={createReview}
          onDeleteReview={deleteReview}
        />
      ) : null}
    </div>
  );
}
