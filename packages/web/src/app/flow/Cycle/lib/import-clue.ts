/**
 * Clue → Nodea importer (pure, Vitest-covered).
 *
 * Clue's data export is NOT a CSV — it's a password-protected `.zip` the user
 * extracts to a `measurements.json` file (helloclue « Télécharger mes
 * données »). Two generations exist, both handled here :
 *
 *  - **modern** `measurements.json` : a flat array of datapoints, one per
 *    tracked value, `{ date, type, value }` — `value` is `{ option }` for
 *    single-value categories (period, spotting, discharge) or an array of
 *    `{ option }` for multi-tag ones (pain, feelings, energy…). Bleeding is
 *    `type:"period"` (light/medium/heavy/very_heavy) plus a SEPARATE
 *    `type:"spotting"`. Machine keys are English snake_case whatever the app
 *    UI language.
 *  - **legacy** `.cluedata` : `{ data: [ { day, period, pain:[…], … } ] }`,
 *    one object per day, `period` a plain string.
 *
 * We map onto the sparse per-day `CyclePayload` : date + flow + free symptoms
 * (+ opt-in bbt / mucus). Clue ships no cycle boundaries — Nodea derives those
 * itself (`cycle-model`). Unknown / meta categories are ignored rather than
 * dumped as noise. Kept pure : the caller stamps `updatedAt` + dedupes by date.
 */
import {
  type CycleFlow,
  type CycleMucus,
  type CyclePayload,
} from '@nodea/shared';

const FLOW_FROM_PERIOD: Record<string, CycleFlow> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  very_heavy: 'heavy', // Nodea has no « very heavy » — collapse to heavy.
};

const MUCUS_FROM_DISCHARGE: Record<string, CycleMucus> = {
  none: 'dry',
  sticky: 'sticky',
  creamy: 'creamy',
  egg_white: 'eggwhite',
};

/** Categories whose options fold into the free-text `symptoms` list. Meta
 *  categories (birth_control, collection_method, appointments, tests…) are
 *  deliberately absent — importing them as « symptoms » would be noise. */
const SYMPTOM_TYPES = new Set([
  'pain',
  'feelings',
  'energy',
  'digestion',
  'mind',
  'motivation',
  'skin',
  'hair',
  'craving',
  'ailments',
  'sleep',
]);

/** French labels for the common Clue options — the app is French-first, so a
 *  bare English snake_case tag reads poorly. Unknown options fall back to a
 *  humanised form (underscores → spaces). Gender-neutral nouns on purpose. */
const OPTION_FR: Record<string, string> = {
  // pain
  period_cramps: 'crampes',
  ovulation: "douleur d'ovulation",
  lower_back: 'lombaires',
  breast_tenderness: 'seins sensibles',
  headache: 'maux de tête',
  migraine: 'migraine',
  nausea: 'nausée',
  pain_free: 'sans douleur',
  // feelings
  happy: 'joie',
  sad: 'tristesse',
  sensitive: 'sensibilité',
  anxious: 'anxiété',
  angry: 'colère',
  indifferent: 'indifférence',
  pms: 'SPM',
  // energy
  energetic: 'énergie',
  fully_energized: 'pleine énergie',
  tired: 'fatigue',
  exhausted: 'épuisement',
  // digestion
  bloated: 'ballonnements',
  gassy: 'gaz',
  nauseous: 'nausée',
  // skin
  acne: 'acné',
  dry_skin: 'peau sèche',
  oily_skin: 'peau grasse',
  good_skin: 'belle peau',
  // craving
  sweet: 'envie de sucré',
  salty: 'envie de salé',
  // sleep
  '0_to_3_hours': 'sommeil 0-3 h',
  '3_to_6_hours': 'sommeil 3-6 h',
  '6_to_9_hours': 'sommeil 6-9 h',
  '9_or_more_hours': 'sommeil 9 h+',
};

function labelFor(option: string): string {
  return OPTION_FR[option] ?? option.replace(/_/g, ' ').trim();
}

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === 'object' && x !== null;
}

/** Normalise a Clue `value` (single object, array of objects, plain string,
 *  plain number, or a `{ celsius | fahrenheit | value }` measurement) into a
 *  list of option strings and/or a numeric reading. */
function readValue(value: unknown): { options: string[]; numeric?: number } {
  if (value == null) return { options: [] };
  if (typeof value === 'string') return { options: [value] };
  if (typeof value === 'number') return { options: [], numeric: value };
  if (Array.isArray(value)) {
    const options: string[] = [];
    for (const v of value) {
      if (typeof v === 'string') options.push(v);
      else if (isRecord(v) && typeof v.option === 'string') options.push(v.option);
    }
    return { options };
  }
  if (isRecord(value)) {
    if (typeof value.option === 'string') return { options: [value.option] };
    if (typeof value.celsius === 'number') return { options: [], numeric: value.celsius };
    if (typeof value.fahrenheit === 'number') {
      return { options: [], numeric: ((value.fahrenheit - 32) * 5) / 9 };
    }
    if (typeof value.value === 'number') return { options: [], numeric: value.value };
  }
  return { options: [] };
}

interface DayAcc {
  date: string;
  flow?: CycleFlow;
  spotting: boolean;
  symptoms: Set<string>;
  bbt?: number;
  mucus?: CycleMucus;
}

export interface ClueParseResult {
  /** One CyclePayload per day that carried something mappable, date-sorted. */
  entries: CyclePayload[];
  /** Days with any mapped data. */
  days: number;
  /** Days with a bleeding flow. */
  withFlow: number;
  /** Earliest / latest mapped date (ISO), or null when empty. */
  from: string | null;
  to: string | null;
}

/**
 * Parse a Clue JSON export (`measurements.json` or legacy `.cluedata`) into
 * per-day `CyclePayload`s. Throws `Error('invalid_json')` on unparseable text
 * and `Error('unrecognized_clue_format')` when the JSON is neither shape.
 */
export function parseClueExport(text: string): ClueParseResult {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('invalid_json');
  }

  const byDate = new Map<string, DayAcc>();
  const dayOf = (iso: string) => iso.split('T')[0] ?? iso;
  const acc = (date: string): DayAcc => {
    let d = byDate.get(date);
    if (!d) {
      d = { date, spotting: false, symptoms: new Set() };
      byDate.set(date, d);
    }
    return d;
  };

  const ingest = (date: string, type: string, value: unknown): void => {
    const day = acc(date);
    const { options, numeric } = readValue(value);
    if (type === 'period') {
      const first = options[0];
      const mapped = first ? FLOW_FROM_PERIOD[first] : undefined;
      if (mapped) day.flow = mapped;
      // Older `.cluedata` stored spotting AS a period option.
      else if (first === 'spotting') day.spotting = true;
    } else if (type === 'spotting') {
      day.spotting = true;
    } else if (type === 'bbt' || type === 'temperature') {
      if (typeof numeric === 'number' && Number.isFinite(numeric)) day.bbt = numeric;
    } else if (type === 'discharge' || type === 'mucus') {
      const first = options[0];
      const mapped = first ? MUCUS_FROM_DISCHARGE[first] : undefined;
      if (mapped) day.mucus = mapped;
    } else if (SYMPTOM_TYPES.has(type)) {
      for (const o of options) {
        const label = labelFor(o);
        if (label) day.symptoms.add(label);
      }
    }
    // Any other category (birth_control, collection_method, …) is ignored.
  };

  if (Array.isArray(json)) {
    // Modern measurements.json — flat datapoint array.
    for (const e of json) {
      if (isRecord(e) && typeof e.date === 'string' && typeof e.type === 'string') {
        ingest(dayOf(e.date), e.type, e.value);
      }
    }
  } else if (isRecord(json) && Array.isArray(json.data)) {
    // Legacy .cluedata — one object per day.
    for (const d of json.data) {
      if (!isRecord(d) || typeof d.day !== 'string') continue;
      const date = dayOf(d.day);
      for (const [type, v] of Object.entries(d)) {
        if (type !== 'day') ingest(date, type, v);
      }
    }
  } else {
    throw new Error('unrecognized_clue_format');
  }

  const entries: CyclePayload[] = [...byDate.values()]
    .map((d): CyclePayload => {
      const flow: CycleFlow | undefined = d.flow ?? (d.spotting ? 'spotting' : undefined);
      return {
        date: d.date,
        ...(flow ? { flow } : {}),
        symptoms: [...d.symptoms].sort(),
        notes: '',
        ...(d.bbt !== undefined ? { bbt: Math.round(d.bbt * 100) / 100 } : {}),
        ...(d.mucus ? { mucus: d.mucus } : {}),
      };
    })
    // Drop days that ended up empty (a category we don't map, e.g. birth_control only).
    .filter(
      (e) =>
        e.flow || (e.symptoms?.length ?? 0) > 0 || e.bbt !== undefined || e.mucus,
    )
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    entries,
    days: entries.length,
    withFlow: entries.filter((e) => e.flow).length,
    from: entries[0]?.date ?? null,
    to: entries[entries.length - 1]?.date ?? null,
  };
}
