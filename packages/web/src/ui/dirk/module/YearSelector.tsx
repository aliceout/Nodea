import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';
import Select from '@/ui/atoms/dirk/Select';

/**
 * Shared year tab strip for every module's list/graph header (Mood · Journal ·
 * Cycle). Leftmost is the module's « rolling » entry (« En cours » / « Tous »),
 * then the most recent `maxButtons` years as chips ; any older years fold into
 * a discreet inline dropdown so a long history (20 years of data) doesn't blow
 * out the row. Props-driven — the context-bound modules pass their own
 * `{ year, setYear }` + labels through a thin wrapper.
 */
interface Props {
  year: number | null;
  /** Years present in the data, DESCENDING (newest first). */
  availableYears: readonly number[];
  onChange: (year: number | null) => void;
  /** Module label for the « no year » chip (« En cours » / « Tous »…). */
  rollingLabel: string;
  ariaLabel: string;
  /** Recent years shown as chips ; the rest go into the dropdown. */
  maxButtons?: number;
  className?: string;
}

const chip = (active: boolean) =>
  cn(
    'cursor-pointer rounded px-2.5 py-1 text-[12px] transition-colors',
    active
      ? 'bg-accent-soft font-semibold text-accent-deep'
      : 'text-muted hover:bg-bg-2 hover:text-ink',
  );

export default function YearSelector({
  year,
  availableYears,
  onChange,
  rollingLabel,
  ariaLabel,
  maxButtons = 6,
  className,
}: Props) {
  const { t } = useI18n();
  const recent = availableYears.slice(0, maxButtons);
  const older = availableYears.slice(maxButtons);
  const olderActive = year !== null && older.includes(year);

  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('flex flex-wrap items-center gap-1', className)}
    >
      <button
        type="button"
        role="tab"
        aria-selected={year === null}
        onClick={() => onChange(null)}
        className={chip(year === null)}
      >
        {rollingLabel}
      </button>
      {recent.map((y) => (
        <button
          key={y}
          type="button"
          role="tab"
          aria-selected={y === year}
          onClick={() => onChange(y)}
          className={cn(chip(y === year), 'tabular-nums')}
        >
          {y}
        </button>
      ))}
      {older.length > 0 ? (
        <Select
          borderless
          aria-label={t('common.selectors.earlierYears')}
          value={olderActive ? String(year) : ''}
          onChange={(e) => {
            if (e.target.value) onChange(Number(e.target.value));
          }}
          className={cn(
            'w-auto text-[12px] tabular-nums',
            olderActive ? 'font-semibold text-accent-deep' : 'text-muted',
          )}
        >
          <option value="" disabled={olderActive}>
            {t('common.selectors.earlier')}
          </option>
          {older.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
      ) : null}
    </div>
  );
}
