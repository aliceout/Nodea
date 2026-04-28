/**
 * Step definitions for the YearCompass-faithful guided tour.
 *
 * The Wizard walks through this array in order. Each step describes:
 *   - where the data lives in the payload (`path`)
 *   - how to render the editor (`kind`)
 *   - the fixed keys it declares, if any
 *   - user-facing copy (title, subtitle, help)
 *
 * Wording, ordering and grouping mirror the official YearCompass A4
 * booklet (https://yearcompass.com/fr/) — see
 * `documentation/Modules/Review.md` for the canonical payload shape.
 *
 * Keep this file declarative — the Wizard renders based on `kind` and
 * never branches on step id.
 */

export type StepGroup = 'welcome' | 'last_year' | 'next_year';

export type StepKind =
  | 'intro' // welcome screen, no payload
  | 'textarea'
  | 'string_list'
  | 'keyed_text' //   Record<key, string>     (e.g. six_phrases)
  | 'keyed_list' //   Record<key, string[]>   (e.g. life_areas, triplets)
  | 'keyed_mixed'; // Record<key, string | string[]> with a per-field editor

/** Tuple of the key in the payload + the label shown to the user.
 *  Used by `keyed_text` and `keyed_list` (uniform per-field editor). */
export interface KeyLabel {
  key: string;
  label: string;
  /** Optional inline note shown below the field (asterisk
   *  footnotes from the booklet, etc.). */
  hint?: string;
}

export type MixedFieldType = 'text' | 'textarea' | 'list' | 'date';

/** Field descriptor for `keyed_mixed` — each field declares its
 *  own editor type (text / textarea / list / date). */
export interface MixedKeyLabel {
  key: string;
  label: string;
  type: MixedFieldType;
  /** Optional inline note shown below the field. */
  hint?: string;
}

export interface BaseStep {
  id: string;
  group: StepGroup;
  /** Dotted path inside the payload (e.g. `last_year.six_phrases`).
   *  Empty string for `intro` steps that don't persist anything. */
  path: string;
  title: string;
  subtitle?: string;
  /** Optional asterisk-footnote-style note rendered under the
   *  step's editor — used for the « pardon » booklet footnote. */
  help?: string;
}

export interface IntroStep extends BaseStep {
  kind: 'intro';
  /** Welcome paragraphs, each rendered as its own <p>. */
  body: string[];
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
export interface KeyedMixedStep extends BaseStep {
  kind: 'keyed_mixed';
  fields: MixedKeyLabel[];
}

export type Step =
  | IntroStep
  | TextareaStep
  | StringListStep
  | KeyedTextStep
  | KeyedListStep
  | KeyedMixedStep;

// --- Field tables ---------------------------------------------------

/** Page 5 + 15 — eight life areas, exactly as the booklet lists
 *  them. Reused for both `last_year.life_areas` and
 *  `next_year.life_areas`. */
const LIFE_AREAS_FIELDS: KeyLabel[] = [
  { key: 'personal_family', label: 'Vie personnelle, famille' },
  { key: 'career_studies', label: 'Carrière, études' },
  { key: 'friends_community', label: 'Amis, communauté' },
  { key: 'leisure_creativity', label: 'Relaxation, loisirs, créativité' },
  { key: 'physical_health', label: 'Santé physique, vitalité' },
  { key: 'mental_health', label: 'Santé mentale, émotionnelle' },
  { key: 'habits', label: 'Habitudes qui te définissent' },
  {
    key: 'better_world',
    label: 'Un avenir meilleur',
    hint: "Qu'as-tu fait cette année pour laisser le monde en meilleur état que celui dans lequel tu l'as trouvé ?",
  },
];

/** Page 6 — Six phrases à propos de mon année précédente. Order
 *  matches the booklet exactly (sage decision → biggest accomplishment). */
const SIX_PHRASES_LAST: KeyLabel[] = [
  { key: 'wisest_decision', label: "La décision la plus sage que j'ai prise…" },
  { key: 'biggest_lesson', label: "La plus grande leçon que j'ai apprise…" },
  { key: 'biggest_risk', label: "Le plus gros risque que j'ai pris…" },
  { key: 'biggest_surprise', label: "La plus grande surprise de l'année…" },
  { key: 'service_rendered', label: "Le plus grand service que j'ai rendu à d'autres…" },
  { key: 'biggest_accomplishment', label: "La plus grande chose que j'ai accomplie…" },
];

/** Page 7 — Six questions. Mixed because the booklet asks for
 *  « three persons » twice (list) and a single reflection on the
 *  four other questions (text). */
const SIX_QUESTIONS: MixedKeyLabel[] = [
  {
    key: 'proud_of',
    label: 'De quoi es-tu le ou la plus fier·ère ?',
    type: 'text',
  },
  {
    key: 'influenced_by',
    label: "Les trois personnes qui ont eu le plus d'influence sur toi",
    type: 'list',
  },
  {
    key: 'influenced',
    label: "Les trois personnes sur lesquelles tu as eu le plus d'influence",
    type: 'list',
  },
  {
    key: 'not_realized',
    label: "Qu'est-ce que tu n'as pas pu réaliser ?",
    type: 'text',
  },
  {
    key: 'best_self_discovery',
    label: 'La meilleure chose que tu aies découverte en toi',
    type: 'text',
  },
  {
    key: 'gratitude',
    label: 'De quoi es-tu le ou la plus reconnaissant·e ?',
    type: 'text',
  },
];

/** Page 9 — Mes trois plus grands succès + Mes trois plus grands
 *  défis. The booklet shows them on the same page with each block
 *  carrying its own follow-up prose questions, so they share a
 *  single step. */
const SUCCESSES_AND_CHALLENGES: MixedKeyLabel[] = [
  {
    key: 'three_successes',
    label: 'Mes trois plus grandes réussites',
    type: 'list',
  },
  {
    key: 'successes_how',
    label: "Qu'as-tu fait pour les accomplir ? Qui t'a aidé à remporter ces succès ? Comment ?",
    type: 'textarea',
  },
  {
    key: 'three_challenges',
    label: 'Mes trois plus grandes épreuves',
    type: 'list',
  },
  {
    key: 'challenges_how',
    label: "Qui ou quoi t'a aidé à surmonter ces épreuves ? Qu'as-tu appris sur toi-même en les surmontant ?",
    type: 'textarea',
  },
];

/** Page 12 — Clôture de l'année écoulée. Three sub-sections of
 *  the booklet's final page-1 spread. */
const CLOSING_LAST: MixedKeyLabel[] = [
  {
    key: 'three_words',
    label: "L'année précédente en trois mots",
    type: 'list',
  },
  {
    key: 'book_title',
    label:
      "Si un livre ou un film avait été créé à propos de l'année écoulée, quel titre lui aurais-tu donné ?",
    type: 'text',
  },
  {
    key: 'farewell',
    label: 'Dis au revoir à ton année passée',
    type: 'textarea',
    hint: "S'il reste quoi que ce soit que tu souhaites écrire ou quelqu'un à qui tu voudrais dire au revoir, fais-le maintenant.",
  },
];

/** Pages 16-17 — Le triplet magique pour l'année à venir.
 *  Order matches the booklet exactly (page 16 first six, then
 *  page 17 six). */
const TRIPLETS: KeyLabel[] = [
  {
    key: 'self_love',
    label: 'Trois choses à propos de moi que je vais aimer cette année',
  },
  {
    key: 'let_go',
    label: 'Trois choses sur lesquelles je suis prêt·e à lâcher prise',
  },
  {
    key: 'main_goals',
    label: 'Les trois choses les plus importantes que je veux accomplir',
  },
  {
    key: 'support',
    label: 'Trois personnes qui seront mon soutien dans les moments difficiles',
  },
  { key: 'discover', label: 'Trois choses que je vais oser découvrir' },
  {
    key: 'say_no',
    label: "Trois choses auxquelles j'aurai le pouvoir de dire non",
  },
  {
    key: 'environment',
    label: 'Trois choses pour rendre mon environnement plus confortable',
  },
  { key: 'morning_routines', label: 'Trois choses que je ferai tous les matins' },
  {
    key: 'self_care',
    label: 'Trois choses pour prendre soin de moi régulièrement',
  },
  { key: 'places', label: 'Trois endroits que je visiterai' },
  {
    key: 'get_closer',
    label: "Trois manières de me rapprocher de ceux que j'aime",
  },
  { key: 'rewards', label: 'Trois récompenses que je m’offrirai pour mes succès' },
];

/** Page 18 — Six phrases sur mon année à venir. Order matches
 *  the booklet exactly. */
const SIX_PHRASES_NEXT: KeyLabel[] = [
  {
    key: 'no_procrastination',
    label: 'Cette année, je ne remettrai plus à demain de…',
  },
  {
    key: 'energy_source',
    label: 'Cette année, je tirerai le plus de mon énergie de…',
  },
  {
    key: 'courage',
    label: 'Cette année je vais être le·la plus courageux·se quand…',
  },
  {
    key: 'positive_answer',
    label: 'Cette année, je répondrai positivement lorsque…',
  },
  { key: 'advice', label: 'Pour cette nouvelle année, je me conseille de…' },
  {
    key: 'special_because',
    label: 'Cette année sera spéciale pour moi, parce que…',
  },
];

// --- Steps ----------------------------------------------------------

export const STEPS: Step[] = [
  // ---- Bienvenue ----------------------------------------------------
  // The general « what is YearCompass » framing lives on the List
  // page (where the user picks a year). This intro step is the
  // last beat before the questions start — practical heads-up only.
  {
    id: 'welcome',
    group: 'welcome',
    path: '',
    kind: 'intro',
    title: 'Avant de commencer',
    body: [
      "Deux moitiés : on célèbre et on apprend du passé, puis on rêve et on planifie le futur.",
      "Compte quelques heures de calme. Tu peux passer une question, y revenir plus tard, ou t'arrêter — ton brouillon est chiffré dans ton navigateur.",
    ],
  },

  // ---- L'année passée -----------------------------------------------
  {
    id: 'agenda_review',
    group: 'last_year',
    path: 'last_year.agenda_review',
    kind: 'string_list',
    title: 'Consulte ton agenda',
    subtitle:
      "Reprends ton calendrier de l'année passée semaine par semaine. Si tu y remarques des événements importants (rassemblements familiaux, amicaux, projets significatifs), écris-les ci-dessous.",
    placeholder: 'Un événement, un voyage, une rencontre…',
  },
  {
    id: 'life_areas_last',
    group: 'last_year',
    path: 'last_year.life_areas',
    kind: 'keyed_list',
    title: "Voici ce qu'a été mon année passée",
    subtitle:
      "Réfléchis aux domaines décrits ci-dessous et demande-toi quels événements significatifs ont eu lieu dans chacun d'entre eux cette année.",
    fields: LIFE_AREAS_FIELDS,
  },
  {
    id: 'six_phrases_last',
    group: 'last_year',
    path: 'last_year.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases à propos de mon année précédente',
    fields: SIX_PHRASES_LAST,
  },
  {
    id: 'six_questions',
    group: 'last_year',
    path: 'last_year.six_questions',
    kind: 'keyed_mixed',
    title: 'Six questions à propos de mon année précédente',
    fields: SIX_QUESTIONS,
  },
  {
    id: 'best_moments',
    group: 'last_year',
    path: 'last_year.best_moments',
    kind: 'textarea',
    title: 'Les meilleurs moments',
    subtitle:
      "Décris les moments les plus beaux, les plus joyeux et les plus remarquables de l'année dernière. Qu'as-tu ressenti ? Avec qui étais-tu ? Qu'avez-vous fait ? Quels parfums, sons, saveurs te reviennent ?",
    placeholder: 'Un moment qui te revient…',
  },
  {
    id: 'successes_and_challenges',
    group: 'last_year',
    path: 'last_year.successes_and_challenges',
    kind: 'keyed_mixed',
    title: 'Mes trois plus grands succès et mes trois plus grands défis',
    fields: SUCCESSES_AND_CHALLENGES,
  },
  {
    id: 'forgiveness',
    group: 'last_year',
    path: 'last_year.forgiveness',
    kind: 'textarea',
    title: 'Pardonner',
    subtitle:
      "As-tu vécu des choses que tu n'as pas encore réussi à pardonner ? Des actes ou des mots qui t'ont blessé·e ? Es-tu en colère contre toi-même ? Tu peux le détailler ci-dessous. Permets-toi d'avancer et pardonne.",
    placeholder: 'Je pardonne à…',
    help: "Si tu penses ne pas être prêt·e à pardonner, écris-le quand même. Cela peut faire des miracles.",
  },
  {
    id: 'letting_go',
    group: 'last_year',
    path: 'last_year.letting_go',
    kind: 'textarea',
    title: 'Lâcher prise',
    subtitle:
      "Qu'as-tu d'autre à dire pour sceller l'année passée ? Sur quoi dois-tu lâcher prise avant de pouvoir commencer l'année qui vient ? Écris, fais le point, et lâche prise sur tous ces sujets.",
    placeholder: 'Je laisse partir…',
  },
  {
    id: 'closing_last',
    group: 'last_year',
    path: 'last_year.closing',
    kind: 'keyed_mixed',
    title: "Clôture de l'année écoulée",
    fields: CLOSING_LAST,
  },

  // ---- L'année devant toi ------------------------------------------
  {
    id: 'dream_big',
    group: 'next_year',
    path: 'next_year.dream_big',
    kind: 'textarea',
    title: 'Ose rêver en grand !',
    subtitle:
      "À quoi ressemble l'année prochaine ? Dans l'idéal, que va-t-il se passer ? Pourquoi ça va être génial ? Écris, oublie tes attentes et ose rêver.",
    placeholder: 'Je me vois…',
  },
  {
    id: 'life_areas_next',
    group: 'next_year',
    path: 'next_year.life_areas',
    kind: 'keyed_list',
    title: 'Cette nouvelle année ressemblera à ça pour moi',
    subtitle:
      "Réfléchis aux domaines de ta vie et décide des objectifs à atteindre dans chacun d'entre eux l'année prochaine. Notes-les ci-dessous — c'est le premier pas vers leur réalisation.",
    fields: LIFE_AREAS_FIELDS,
  },
  {
    id: 'triplets',
    group: 'next_year',
    path: 'next_year.triplets',
    kind: 'keyed_list',
    title: "Le triplet magique pour l'année à venir",
    subtitle: 'Trois choses par thème : ce qui guidera ton année.',
    fields: TRIPLETS,
  },
  {
    id: 'six_phrases_next',
    group: 'next_year',
    path: 'next_year.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases sur mon année à venir',
    fields: SIX_PHRASES_NEXT,
  },
  {
    id: 'word_of_year',
    group: 'next_year',
    path: 'next_year.word_of_year',
    kind: 'textarea',
    title: "Mon mot pour l'année prochaine",
    subtitle:
      "Choisis-toi un mot pour l'année prochaine. Il te donnera le pouvoir de ne pas abandonner tes rêves, et tu peux compter sur lui si tu as besoin d'un coup de pouce. Ce mot définit l'année à venir.",
    placeholder: 'Un mot…',
  },
  {
    id: 'secret_wish',
    group: 'next_year',
    path: 'next_year.secret_wish',
    kind: 'textarea',
    title: 'Souhait secret',
    subtitle:
      "Laisse libre cours à ton esprit. Quel est ton désir secret pour l'année à venir ?",
    placeholder: 'Mon vœu pour cette année…',
  },
];

export const GROUP_LABELS: Record<StepGroup, string> = {
  welcome: 'Bienvenue',
  last_year: "L'année passée",
  next_year: "L'année devant toi",
};

/**
 * Question-only step list — drops `intro` welcome screens. The
 * topbar counter, the StepNav rail and the « Un parcours guidé en
 * N étapes » copy on the list view all reference this length so
 * the welcome screen doesn't inflate the count.
 */
export const QUESTION_STEPS: Step[] = STEPS.filter((s) => s.kind !== 'intro');

/** Position of `step` in QUESTION_STEPS, or -1 for intro steps. */
export function questionPosition(step: Step): number {
  if (step.kind === 'intro') return -1;
  return QUESTION_STEPS.findIndex((s) => s.id === step.id);
}

/**
 * Walk a dotted path on an object, creating intermediate records as
 * needed. Returns the object with the new value set.
 */
export function setByPath<T>(
  obj: Record<string, unknown>,
  path: string,
  value: T,
): Record<string, unknown> {
  const parts = path.split('.');
  const copy: Record<string, unknown> = { ...obj };
  let cursor: Record<string, unknown> = copy;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const key = parts[i]!;
    const next = cursor[key];
    cursor[key] =
      next && typeof next === 'object' && !Array.isArray(next)
        ? { ...(next as Record<string, unknown>) }
        : {};
    cursor = cursor[key] as Record<string, unknown>;
  }
  cursor[parts[parts.length - 1]!] = value;
  return copy;
}

export function getByPath(
  obj: Record<string, unknown> | undefined,
  path: string,
): unknown {
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
