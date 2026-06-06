/**
 * HRT domain vocabulary — curated medication & lab-marker presets.
 *
 * Where it sits : `@nodea/shared` so the api seeder, the web forms and
 * the lab chart all read one source. Pure data + tiny pure lookups, no
 * runtime deps.
 *
 * Design contract : presets **suggest**, they never constrain. The Zod
 * payload schemas (`schemas/modules.ts`) keep `medication` / `marker` /
 * `unit` as free strings — someone on an uncommon protocol, or a lab
 * reporting an exotic unit, is never blocked. These lists drive
 * autocomplete, default-unit/route hints and unit conversion only.
 *
 * Not medical advice. Marker metadata (canonical unit, molar
 * conversion factors) is factual ; any *target ranges* shown in the UI
 * are informational (WPATH / Endocrine Society) and decided at the
 * presentation layer, never here.
 */
import type { HrtCategory, HrtRoute } from './schemas/modules.ts';

export interface HrtMedicationPreset {
  /** Stable key (snake_case) — safe to store / compare. */
  id: string;
  /** Display label (FR). */
  label: string;
  category: HrtCategory;
  defaultRoute: HrtRoute;
  defaultUnit: string;
}

/**
 * Common molecules across transfeminine, transmasculine and
 * non-binary regimens. Order groups by category for the picker.
 */
export const HRT_MEDICATIONS: readonly HrtMedicationPreset[] = [
  // Œstrogènes
  { id: 'estradiol_valerate', label: 'Estradiol valérate', category: 'estrogen', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'estradiol_cypionate', label: 'Estradiol cypionate', category: 'estrogen', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'estradiol_enantate', label: 'Estradiol énanthate', category: 'estrogen', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'estradiol_oral', label: 'Estradiol (oral)', category: 'estrogen', defaultRoute: 'oral', defaultUnit: 'mg' },
  { id: 'estradiol_gel', label: 'Estradiol gel', category: 'estrogen', defaultRoute: 'gel', defaultUnit: 'mg' },
  { id: 'estradiol_patch', label: 'Estradiol patch', category: 'estrogen', defaultRoute: 'patch', defaultUnit: 'µg/24h' },
  // Anti-androgènes
  { id: 'spironolactone', label: 'Spironolactone', category: 'antiandrogen', defaultRoute: 'oral', defaultUnit: 'mg' },
  { id: 'cyproterone_acetate', label: 'Cyprotérone acétate', category: 'antiandrogen', defaultRoute: 'oral', defaultUnit: 'mg' },
  { id: 'bicalutamide', label: 'Bicalutamide', category: 'antiandrogen', defaultRoute: 'oral', defaultUnit: 'mg' },
  // Agonistes GnRH
  { id: 'triptorelin', label: 'Triptoréline', category: 'gnrh', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'leuprorelin', label: 'Leuproréline', category: 'gnrh', defaultRoute: 'injection_sc', defaultUnit: 'mg' },
  // Progestatif
  { id: 'progesterone', label: 'Progestérone', category: 'progestogen', defaultRoute: 'oral', defaultUnit: 'mg' },
  // Testostérone
  { id: 'testosterone_enantate', label: 'Testostérone énanthate', category: 'testosterone', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'testosterone_cypionate', label: 'Testostérone cypionate', category: 'testosterone', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'testosterone_undecanoate', label: 'Testostérone undécanoate', category: 'testosterone', defaultRoute: 'injection_im', defaultUnit: 'mg' },
  { id: 'testosterone_gel', label: 'Testostérone gel', category: 'testosterone', defaultRoute: 'gel', defaultUnit: 'mg' },
];

/** HRT goal — sex-hormone targets flip between the two directions. */
export const HRT_GOALS = ['feminizing', 'masculinizing'] as const;
export type HrtGoal = (typeof HRT_GOALS)[number];

/** An informational target / reference range, in a marker's canonical
 *  unit. Either bound may be absent (e.g. a safety upper limit only). */
export interface HrtTargetRange {
  min?: number;
  max?: number;
}

export interface HrtMarkerPreset {
  /** Stable key (snake_case) — what we store in the payload. */
  key: string;
  /** Display label (FR). */
  label: string;
  /** The unit the chart normalises to. */
  canonicalUnit: string;
  /** Units commonly seen on lab reports for this marker. */
  units: readonly string[];
  /** Multiplicative factors `canonicalUnit → otherUnit`. Present only
   *  for the standard, unambiguous molar conversions. */
  toUnit?: Readonly<Record<string, number>>;
  /** Goal-dependent target range (sex hormones), in `canonicalUnit`. */
  targets?: Partial<Record<HrtGoal, HrtTargetRange>>;
  /** Goal-independent safe / reference range (safety markers), in
   *  `canonicalUnit`. Takes precedence over `targets`. */
  safe?: HrtTargetRange;
}

/**
 * Hormonal + safety markers routinely monitored under HRT.
 *
 * `targets` / `safe` are **informational** reference ranges (rough
 * WPATH / Endocrine Society guidance), in each marker's canonical unit.
 * They are never prescriptive — the UI gates them behind an explicit
 * choice + a disclaimer.
 */
export const HRT_MARKERS: readonly HrtMarkerPreset[] = [
  // Hormones
  { key: 'estradiol', label: 'Œstradiol (E2)', canonicalUnit: 'pg/mL', units: ['pg/mL', 'pmol/L'], toUnit: { 'pmol/L': 3.6713 }, targets: { feminizing: { min: 100, max: 200 } } },
  { key: 'testosterone_total', label: 'Testostérone totale', canonicalUnit: 'ng/dL', units: ['ng/dL', 'nmol/L'], toUnit: { 'nmol/L': 0.03467 }, targets: { feminizing: { max: 50 }, masculinizing: { min: 400, max: 700 } } },
  { key: 'testosterone_free', label: 'Testostérone libre', canonicalUnit: 'pg/mL', units: ['pg/mL', 'pmol/L'] },
  { key: 'lh', label: 'LH', canonicalUnit: 'IU/L', units: ['IU/L'] },
  { key: 'fsh', label: 'FSH', canonicalUnit: 'IU/L', units: ['IU/L'] },
  { key: 'prolactin', label: 'Prolactine', canonicalUnit: 'µg/L', units: ['µg/L', 'mIU/L'], safe: { max: 25 } },
  { key: 'shbg', label: 'SHBG', canonicalUnit: 'nmol/L', units: ['nmol/L'] },
  { key: 'progesterone', label: 'Progestérone', canonicalUnit: 'ng/mL', units: ['ng/mL', 'nmol/L'] },
  // Sécurité
  { key: 'alt', label: 'ALAT', canonicalUnit: 'IU/L', units: ['IU/L'], safe: { max: 40 } },
  { key: 'ast', label: 'ASAT', canonicalUnit: 'IU/L', units: ['IU/L'], safe: { max: 40 } },
  { key: 'ggt', label: 'GGT', canonicalUnit: 'IU/L', units: ['IU/L'], safe: { max: 55 } },
  { key: 'potassium', label: 'Potassium (K⁺)', canonicalUnit: 'mmol/L', units: ['mmol/L'], safe: { min: 3.5, max: 5 } },
  { key: 'creatinine', label: 'Créatinine', canonicalUnit: 'µmol/L', units: ['µmol/L', 'mg/dL'] },
  { key: 'hematocrit', label: 'Hématocrite', canonicalUnit: '%', units: ['%'], safe: { max: 50 } },
  { key: 'hemoglobin', label: 'Hémoglobine', canonicalUnit: 'g/dL', units: ['g/dL', 'g/L'] },
];

const MEDICATIONS_BY_ID = new Map(HRT_MEDICATIONS.map((m) => [m.id, m]));
const MARKERS_BY_KEY = new Map(HRT_MARKERS.map((m) => [m.key, m]));

export function findMedication(id: string): HrtMedicationPreset | undefined {
  return MEDICATIONS_BY_ID.get(id);
}

export function findMarker(key: string): HrtMarkerPreset | undefined {
  return MARKERS_BY_KEY.get(key);
}

/**
 * The informational range to show for a marker under a given goal. A
 * safety marker's `safe` range wins (goal-independent) ; otherwise the
 * sex-hormone `targets[goal]`. `undefined` when the marker has none.
 */
export function targetFor(
  marker: HrtMarkerPreset,
  goal: HrtGoal,
): HrtTargetRange | undefined {
  return marker.safe ?? marker.targets?.[goal];
}

/**
 * Convert a value expressed in a marker's canonical unit to another
 * unit. Returns the same value when `toUnit` is the canonical unit,
 * and `null` when no conversion factor is known (caller shows the raw
 * value + unit instead of guessing).
 */
export function convertFromCanonical(
  marker: HrtMarkerPreset,
  value: number,
  toUnit: string,
): number | null {
  if (toUnit === marker.canonicalUnit) return value;
  const factor = marker.toUnit?.[toUnit];
  return factor === undefined ? null : value * factor;
}

/**
 * Convert a value expressed in `fromUnit` back to the marker's
 * canonical unit. Inverse of {@link convertFromCanonical}. `null` when
 * the unit isn't the canonical one and has no known factor.
 */
export function toCanonical(
  marker: HrtMarkerPreset,
  value: number,
  fromUnit: string,
): number | null {
  if (fromUnit === marker.canonicalUnit) return value;
  const factor = marker.toUnit?.[fromUnit];
  return factor === undefined ? null : value / factor;
}

/**
 * Convert between any two of a marker's known units (via the canonical
 * unit as pivot). Returns `null` if either leg has no known factor —
 * the caller then keeps the raw value rather than plotting a guess.
 */
export function convertMarkerValue(
  marker: HrtMarkerPreset,
  value: number,
  fromUnit: string,
  toUnit: string,
): number | null {
  if (fromUnit === toUnit) return value;
  const canon = toCanonical(marker, value, fromUnit);
  if (canon === null) return null;
  return convertFromCanonical(marker, canon, toUnit);
}
