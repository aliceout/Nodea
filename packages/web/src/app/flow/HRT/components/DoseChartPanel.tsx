/**
 * HRT · DoseChartPanel — the Summary dashboard's dose chart (the 3/4
 * column of section 1). A borderless, title-like molecule `<Select>`
 * sits in the chart header, and the `LabChart` fills the column height
 * (`fillHeight`). Falls back to a dashed placeholder when nothing is
 * logged yet. Pure presentation — the molecule selection and the series
 * are owned by `SummaryView`.
 */
import Select from '@/ui/atoms/dirk/Select';

import LabChart, { type ChartPoint } from './LabChart';
import type { MoleculeCount } from '../lib/admin-data';

interface DoseChartPanelProps {
  molecules: ReadonlyArray<MoleculeCount>;
  activeMolecule: string | null;
  onSelectMolecule: (name: string) => void;
  points: ReadonlyArray<ChartPoint>;
  hasProducts: boolean;
}

export default function DoseChartPanel({
  molecules,
  activeMolecule,
  onSelectMolecule,
  points,
  hasProducts,
}: DoseChartPanelProps) {
  return (
    <div className="flex min-w-0 lg:col-span-3">
      {activeMolecule ? (
        <LabChart
          points={points}
          unit="mg"
          label={activeMolecule}
          fillHeight
          caption={
            <span className="flex items-center gap-2">
              <Select
                aria-label="Molécule du graphique"
                borderless
                className="w-auto px-0 font-medium"
                value={activeMolecule}
                onChange={(e) => onSelectMolecule(e.target.value)}
              >
                {molecules.map((m) => (
                  <option key={m.name} value={m.name}>
                    {m.name}
                  </option>
                ))}
              </Select>
              <span className="font-normal text-muted">(mg)</span>
            </span>
          }
        />
      ) : (
        <div className="flex min-h-[200px] w-full items-center justify-center rounded-lg border border-dashed border-hair p-12 text-center text-[13px] text-muted">
          {hasProducts
            ? 'Aucune prise enregistrée.'
            : 'Enregistre un produit, puis une prise, pour voir le graphique.'}
        </div>
      )}
    </div>
  );
}
