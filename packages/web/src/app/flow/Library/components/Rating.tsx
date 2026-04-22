import { StarIcon as SolidStar } from '@heroicons/react/24/solid';
import { StarIcon as OutlineStar } from '@heroicons/react/24/outline';

interface RatingProps {
  value: number | undefined;
  onChange?: (next: number | undefined) => void;
  readOnly?: boolean;
  size?: 'sm' | 'md';
}

/**
 * 0..5 star rating. Click to set, click again on the same value to clear.
 */
export default function Rating({ value, onChange, readOnly, size = 'md' }: RatingProps) {
  const dim = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const current = value ?? 0;

  return (
    <div className="inline-flex items-center gap-0.5" role={readOnly ? 'img' : 'radiogroup'} aria-label={`Note ${current}/5`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= current;
        const Icon = filled ? SolidStar : OutlineStar;
        if (readOnly || !onChange) {
          return <Icon key={n} className={`${dim} text-amber-500`} aria-hidden />;
        }
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={filled}
            aria-label={`${n} étoile${n > 1 ? 's' : ''}`}
            onClick={() => onChange(current === n ? undefined : n)}
            className="cursor-pointer"
          >
            <Icon className={`${dim} text-amber-500 transition-transform hover:scale-110`} />
          </button>
        );
      })}
    </div>
  );
}
