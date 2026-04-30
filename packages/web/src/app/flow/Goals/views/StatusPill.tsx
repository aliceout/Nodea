import { useI18n } from '@/i18n/I18nProvider.jsx';
import { cn } from '@/lib/utils';

import { useGoalsActions } from '../context';
import { STATUS_TONE } from '../lib/constants';
import type { CanonicalStatus, GoalEntry } from '../lib/types';

interface StatusPillProps {
  entry: GoalEntry;
}

/**
 * Inline status pill — clicking cycles through open → wip → done →
 * open. Reads `cycleStatus` from the actions context and forwards
 * the entry, so the call site only passes the entry itself. Tones
 * and labels live in `lib/constants` and stay shared with the
 * sidebar status filter chips.
 */
export default function StatusPill({ entry }: StatusPillProps) {
  const { t } = useI18n();
  const { cycleStatus } = useGoalsActions();
  const label = t(`goals.status.lower.${entry.status}`);
  return (
    <button
      type="button"
      onClick={() => void cycleStatus(entry)}
      aria-label={t('goals.statusPill.ariaLabel', { values: { label } })}
      title={t('goals.statusPill.title', { values: { label } })}
      className={cn(
        'inline-flex h-6 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-medium transition-colors',
        STATUS_TONE[entry.status],
      )}
    >
      <StatusGlyph status={entry.status} />
      <span className="tracking-[0.01em]">{label}</span>
    </button>
  );
}

/** Hand-rolled SVG glyphs — heroicons doesn't ship a half-filled
 *  circle that matches the K aesthetic. 8×8, `currentColor`. Done
 *  is a checkmark, wip is a half-filled disc, open is an empty
 *  ring. */
function StatusGlyph({ status }: { status: CanonicalStatus }) {
  if (status === 'done') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <path
          d="M1.5 4l1.6 1.6L6.5 2.4"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    );
  }
  if (status === 'wip') {
    return (
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
        <path d="M4 1 A3 3 0 0 1 4 7 Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
      <circle cx="4" cy="4" r="3" stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
