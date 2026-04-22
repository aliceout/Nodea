/**
 * Step definitions for the YearCompass-inspired guided tour.
 *
 * The Wizard walks through this array in order. Each step describes:
 *   - where the data lives in the payload (`path`)
 *   - how to render the editor (`kind`)
 *   - the fixed keys it declares, if any
 *   - user-facing copy (title, subtitle, help)
 *
 * Keep this file declarative — the Wizard renders based on `kind` and
 * never branches on step id.
 *
 * See `documentation/Modules/Review.md` for the canonical payload.
 */

export type StepGroup = 'last_year' | 'next_year' | 'closing';

export type StepKind =
  | 'textarea'
  | 'string_list'
  | 'keyed_text' // Record<key, string>  (e.g. six_phrases)
  | 'keyed_list' // Record<key, string[]>  (e.g. life_areas, triplets)
  | 'closing_last' // book_title + three_words
  | 'closing_final' // letter_to_self + commitment + signature + date
  | 'year_image';

/** Tuple of the key in the payload + the label shown to the user. */
export interface KeyLabel {
  key: string;
  label: string;
  hint?: string;
}

export interface BaseStep {
  id: string;
  group: StepGroup;
  /** Dotted path inside the payload (e.g. `last_year.six_phrases`). */
  path: string;
  title: string;
  subtitle?: string;
  help?: string;
}

export interface TextareaStep extends BaseStep {
  kind: 'textarea';
  placeholder?: string;
}
export interface StringListStep extends BaseStep {
  kind: 'string_list';
  placeholder?: string;
}
export interface KeyedTextStep extends BaseStep {
  kind: 'keyed_text';
  fields: KeyLabel[];
}
export interface KeyedListStep extends BaseStep {
  kind: 'keyed_list';
  fields: KeyLabel[];
}
export interface ClosingLastStep extends BaseStep {
  kind: 'closing_last';
}
export interface ClosingFinalStep extends BaseStep {
  kind: 'closing_final';
}
export interface YearImageStep extends BaseStep {
  kind: 'year_image';
}

export type Step =
  | TextareaStep
  | StringListStep
  | KeyedTextStep
  | KeyedListStep
  | ClosingLastStep
  | ClosingFinalStep
  | YearImageStep;

const LIFE_AREAS: KeyLabel[] = [
  { key: 'family', label: 'Famille' },
  { key: 'friends', label: 'Amitiés' },
  { key: 'work', label: 'Travail / études' },
  { key: 'health', label: 'Santé' },
  { key: 'finance', label: 'Argent' },
  { key: 'fun_creativity', label: 'Plaisir & créativité' },
  { key: 'better_world', label: 'Un monde meilleur' },
];

const SIX_PHRASES_LAST: KeyLabel[] = [
  { key: 'biggest_accomplishment', label: 'Ma plus grande réussite cette année' },
  { key: 'service_rendered', label: 'Le plus grand service que j’ai rendu' },
  { key: 'biggest_surprise', label: 'La plus grande surprise de l’année' },
  { key: 'biggest_risk', label: 'Le plus grand risque que j’ai pris' },
  { key: 'lesson_learned', label: 'La leçon que je retiens' },
  { key: 'best_decision', label: 'Ma meilleure décision' },
];

const SIX_QUESTIONS: KeyLabel[] = [
  { key: 'gratitude', label: 'Les personnes auxquelles je suis reconnaissant·e' },
  { key: 'best_discovery', label: 'Mes plus belles découvertes' },
  { key: 'not_realized', label: 'Ce que je n’ai pas réussi à accomplir' },
  { key: 'influenced', label: 'Les personnes que j’ai influencées' },
  { key: 'influenced_by', label: 'Les personnes qui m’ont influencé·e' },
  { key: 'proud_of', label: 'Ce dont je suis fier·e' },
];

const SIX_PHRASES_NEXT: KeyLabel[] = [
  { key: 'special_because', label: 'Cette année sera spéciale parce que…' },
  { key: 'advice', label: 'Un conseil que je me donne' },
  { key: 'positive_answer', label: 'Quand les choses iront mal, je me dirai…' },
  { key: 'courage', label: 'Ce qui demandera le plus de courage' },
  { key: 'energy_source', label: 'Ma source d’énergie' },
  { key: 'no_procrastination', label: 'Je ne remettrai plus à plus tard…' },
];

const TRIPLETS: KeyLabel[] = [
  { key: 'say_no', label: 'Dire non' },
  { key: 'discover', label: 'Découvrir' },
  { key: 'support', label: 'Soutenir' },
  { key: 'main_goals', label: 'Objectifs principaux' },
  { key: 'let_go', label: 'Lâcher' },
  { key: 'self_love', label: 'Pour mieux m’aimer' },
  { key: 'rewards', label: 'Me récompenser avec' },
  { key: 'get_closer', label: 'Me rapprocher de' },
  { key: 'places', label: 'Lieux à visiter' },
  { key: 'self_care', label: 'Prendre soin de moi' },
  { key: 'morning_routines', label: 'Rituels du matin' },
  { key: 'environment', label: 'Mon environnement' },
];

export const STEPS: Step[] = [
  // --- Année qui se termine -------------------------------------------
  {
    id: 'agenda_review',
    group: 'last_year',
    path: 'last_year.agenda_review',
    kind: 'string_list',
    title: 'Relecture de ton agenda',
    subtitle: 'Les moments marquants de l’année, mois par mois.',
    placeholder: 'Un événement, un voyage, une rencontre…',
  },
  {
    id: 'life_areas_last',
    group: 'last_year',
    path: 'last_year.life_areas',
    kind: 'keyed_list',
    title: 'Les grands domaines de vie',
    subtitle: 'Pour chaque domaine, note ce qui t’a marqué cette année.',
    fields: LIFE_AREAS,
  },
  {
    id: 'six_phrases_last',
    group: 'last_year',
    path: 'last_year.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases pour résumer l’année',
    fields: SIX_PHRASES_LAST,
  },
  {
    id: 'six_questions',
    group: 'last_year',
    path: 'last_year.six_questions',
    kind: 'keyed_list',
    title: 'Six questions',
    fields: SIX_QUESTIONS,
  },
  {
    id: 'best_moments',
    group: 'last_year',
    path: 'last_year.best_moments',
    kind: 'string_list',
    title: 'Les plus beaux moments',
    subtitle: 'Les souvenirs que tu veux garder précieusement.',
    placeholder: 'Un moment, un souvenir…',
  },
  {
    id: 'three_challenges',
    group: 'last_year',
    path: 'last_year.three_challenges',
    kind: 'string_list',
    title: 'Trois plus gros défis',
    placeholder: 'Un défi affronté cette année…',
  },
  {
    id: 'three_successes',
    group: 'last_year',
    path: 'last_year.three_successes',
    kind: 'string_list',
    title: 'Trois plus beaux succès',
    placeholder: 'Un succès dont tu es fier·e…',
  },
  {
    id: 'forgiveness',
    group: 'last_year',
    path: 'last_year.forgiveness',
    kind: 'textarea',
    title: 'Pardon',
    subtitle: 'À qui ou à quoi veux-tu pardonner, y compris à toi-même ?',
    placeholder: 'Je pardonne à…',
  },
  {
    id: 'letting_go',
    group: 'last_year',
    path: 'last_year.letting_go',
    kind: 'textarea',
    title: 'Laisser partir',
    subtitle: 'Ce que tu choisis de laisser derrière toi.',
    placeholder: 'Je laisse partir…',
  },
  {
    id: 'closing_last',
    group: 'last_year',
    path: 'last_year.closing',
    kind: 'closing_last',
    title: 'Clôture de l’année écoulée',
    subtitle: 'Un titre, trois mots.',
  },

  // --- Année à venir --------------------------------------------------
  {
    id: 'dream_big',
    group: 'next_year',
    path: 'next_year.dream_big',
    kind: 'textarea',
    title: 'Rêver en grand',
    subtitle: 'Raconte ton année idéale, sans limite.',
    placeholder: 'Je me vois…',
  },
  {
    id: 'life_areas_next',
    group: 'next_year',
    path: 'next_year.life_areas',
    kind: 'keyed_list',
    title: 'Grands domaines de vie (à venir)',
    subtitle: 'Quelles intentions pour chaque domaine cette année ?',
    fields: LIFE_AREAS,
  },
  {
    id: 'triplets',
    group: 'next_year',
    path: 'next_year.triplets',
    kind: 'keyed_list',
    title: 'Douze triplets',
    subtitle: 'Trois idées par thème : ce qui guidera ton année.',
    fields: TRIPLETS,
  },
  {
    id: 'six_phrases_next',
    group: 'next_year',
    path: 'next_year.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases qui donnent le ton',
    fields: SIX_PHRASES_NEXT,
  },
  {
    id: 'secret_wish',
    group: 'next_year',
    path: 'next_year.secret_wish',
    kind: 'textarea',
    title: 'Mon vœu secret',
    placeholder: 'Mon vœu pour cette année…',
  },
  {
    id: 'word_of_year',
    group: 'next_year',
    path: 'next_year.word_of_year',
    kind: 'textarea',
    title: 'Le mot de l’année',
    subtitle: 'Un seul mot qui résume ce que tu veux incarner.',
    placeholder: 'Un mot…',
  },
  {
    id: 'year_image',
    group: 'next_year',
    path: 'next_year.year_image',
    kind: 'year_image',
    title: 'L’image de l’année',
    subtitle: 'Une image symbolique de l’année à venir (stockée chiffrée).',
  },

  // --- Clôture --------------------------------------------------------
  {
    id: 'closing_final',
    group: 'closing',
    path: 'closing',
    kind: 'closing_final',
    title: 'Clôture',
    subtitle: 'Une lettre, un engagement, ta signature.',
  },
];

export const GROUP_LABELS: Record<StepGroup, string> = {
  last_year: 'Année qui se termine',
  next_year: 'Année à venir',
  closing: 'Clôture',
};

/**
 * Walk a dotted path on an object, creating intermediate records as
 * needed. Returns the object with the new value set.
 */
export function setByPath<T>(obj: Record<string, unknown>, path: string, value: T): Record<string, unknown> {
  const parts = path.split('.');
  const copy: Record<string, unknown> = { ...obj };
  let cursor: Record<string, unknown> = copy;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    cursor[key] = next && typeof next === 'object' && !Array.isArray(next) ? { ...(next as Record<string, unknown>) } : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
  return copy;
}

export function getByPath(obj: Record<string, unknown> | undefined, path: string): unknown {
  if (!obj) return undefined;
  const parts = path.split('.');
  let cursor: unknown = obj;
  for (const part of parts) {
    if (cursor && typeof cursor === 'object' && part in cursor) {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}
