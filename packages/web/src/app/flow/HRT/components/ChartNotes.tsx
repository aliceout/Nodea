/**
 * HRT · ChartNotes — the captions under the Analyses chart : the
 * informational target range, a « no target » hint when a goal is picked
 * but the marker has none, and a count of readings dropped because their
 * unit couldn't be converted to the display unit. Pure presentation,
 * lifted out of `LabsView` to keep it to orchestration.
 */
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
  const s = skipped > 1 ? 's' : '';
  return (
    <>
      {targetText ? (
        <p className="mt-1 text-[11px] text-muted-soft">
          {targetText} — informatif, pas un avis médical.
        </p>
      ) : goalActive ? (
        <p className="mt-1 text-[11px] text-muted-soft">
          Pas de cible définie pour ce marqueur.
        </p>
      ) : null}
      {skipped > 0 ? (
        <p className="mt-1 text-[11px] text-muted-soft">
          {skipped} résultat{s} non convertible{s} en {unit} — masqué{s} du graphique.
        </p>
      ) : null}
    </>
  );
}
