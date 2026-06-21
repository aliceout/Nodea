import { StarIcon } from '@heroicons/react/24/outline';
import { StarIcon as StarSolidIcon } from '@heroicons/react/24/solid';

import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

/**
 * Hover-revealed star toggle for a Library item's `isFavorite` flag.
 * Extracted from BookGrid + ItemRow (REFACTO-08) — identical click
 * handler, a11y labels, and conditional solid/outline icon ; only the
 * box / icon dimensions differed (`sm` = grid cards, `md` = list rows).
 *
 * When not favorited the button is hidden until the row/card is hovered
 * or focus-within (the `group-hover` / `group-focus-within` classes rely
 * on a `group` ancestor, which both call sites provide).
 */
interface FavoriteToggleProps {
  isFavorite: boolean;
  onToggle: () => void;
  size?: 'sm' | 'md';
}

export default function FavoriteToggle({
  isFavorite,
  onToggle,
  size = 'sm',
}: FavoriteToggleProps) {
  const { t } = useI18n();
  const label = isFavorite
    ? t('library.row.favoriteRemove')
    : t('library.row.favoriteAdd');
  const Icon = isFavorite ? StarSolidIcon : StarIcon;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex cursor-pointer items-center justify-center rounded-sm transition-colors',
        size === 'md' ? 'h-7 w-7' : 'h-6 w-6',
        isFavorite
          ? 'text-accent hover:bg-accent-soft'
          : 'text-muted opacity-0 hover:bg-bg-2 hover:text-ink group-hover:opacity-100 group-focus-within:opacity-100',
      )}
    >
      <Icon className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} aria-hidden="true" />
    </button>
  );
}
