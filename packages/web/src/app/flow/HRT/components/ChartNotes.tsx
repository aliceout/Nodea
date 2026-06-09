/**
 * HRT · ChartNotes — the captions under the Analyses chart : the
 * informational target range, a « no target » hint when a goal is picked
 * but the marker has none, and a count of readings dropped because their
 * unit couldn't be converted to the display unit. Pure presentation,
 * lifted out of `LabsView` to keep it to orchestration. Copy resolves
 * through the `hrt.labs.*` i18n keys (plural-aware for the skip count).
 */
import { useI18n } from '@/i18n/I18nProvider.jsx';

interface ChartNotesProps {
  /** Resolved target-range label, or null when no goal / no target. */
  targetText: string | null;
  /** A goal is selected (drives the « no target defined » fallback). */
  goalActive: boolean;
  /** Readings dropped from the chart (non-convertible to `unit`). */
  skipped: number;
  unit: string;
}

export default function ChartNotes({ targetText, goalActive, skipped, unit }: ChartNotesProps) {
  const { t, tn } = useI18n();
  return (
    <>
      {targetText ? (
        <p className="mt-1 text-[11px] text-muted-soft">
          {t('hrt.labs.targetInfo', { values: { target: targetText } })}
        </p>
      ) : goalActive ? (
        <p className="mt-1 text-[11px] text-muted-soft">{t('hrt.labs.noTarget')}</p>
      ) : null}
      {skipped > 0 ? (
        <p className="mt-1 text-[11px] text-muted-soft">
          {tn('hrt.labs.skipped', skipped, { values: { unit } })}
        </p>
      ) : null}
    </>
  );
}
