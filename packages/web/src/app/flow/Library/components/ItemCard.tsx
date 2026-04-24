import type { LibItem, LibReview } from '../hooks/useLibrary';
import Rating from './Rating';

const TYPE_LABEL: Record<string, string> = {
  book: 'Livre',
  movie: 'Film',
  tv: 'Série',
  doc: 'Docu',
};
const STATUS_LABEL: Record<string, string> = {
  planned: 'Prévu',
  in_progress: 'En cours',
  finished: 'Terminé',
  abandoned: 'Abandonné',
};
const STATUS_CLASS: Record<string, string> = {
  planned: 'bg-slate-100 text-slate-800',
  in_progress: 'bg-sky-100 text-sky-800',
  finished: 'bg-emerald-100 text-emerald-800',
  abandoned: 'bg-rose-100 text-rose-800',
};

interface ItemCardProps {
  item: LibItem;
  reviews: LibReview[];
  onOpen(): void;
}

export default function ItemCard({ item, reviews, onOpen }: ItemCardProps) {
  const p = item.payload;
  const reviewCount = reviews.filter((r) => r.payload.item_rid === item.id).length;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex flex-col overflow-hidden rounded border border-slate-200 bg-white text-left shadow-sm transition-shadow hover:shadow-md dark:border-slate-700 dark:bg-slate-900"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-slate-100 dark:bg-slate-800">
        {p.cover_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={p.cover_url}
            alt=""
            className="h-full w-full object-cover transition-transform group-hover:scale-105"
            onError={(e) => {
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-40">
            {p.type === 'book' ? '📖' : p.type === 'movie' ? '🎬' : p.type === 'tv' ? '📺' : '🎞'}
          </div>
        )}
        <span
          className={
            'absolute left-2 top-2 rounded px-1.5 py-0.5 text-xs font-medium ' +
            (STATUS_CLASS[p.status] ?? STATUS_CLASS['planned'])
          }
        >
          {STATUS_LABEL[p.status] ?? p.status}
        </span>
      </div>
      <div className="flex-1 space-y-1 p-3">
        <p className="line-clamp-2 text-sm font-medium">{p.title}</p>
        {p.creators.length > 0 ? (
          <p className="line-clamp-1 text-xs opacity-60">{p.creators.join(', ')}</p>
        ) : null}
        <div className="flex items-center justify-between pt-1">
          <span className="text-xs opacity-60">
            {TYPE_LABEL[p.type] ?? p.type}
            {p.year ? ` · ${p.year}` : ''}
          </span>
          {p.rating != null ? <Rating value={p.rating} readOnly size="sm" /> : null}
        </div>
        {reviewCount > 0 ? (
          <p className="text-xs opacity-60">
            {reviewCount} fiche{reviewCount > 1 ? 's' : ''}
          </p>
        ) : null}
      </div>
    </button>
  );
}
