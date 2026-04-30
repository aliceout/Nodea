import type { KeyLabel, MixedKeyLabel } from './step-types.ts';

/**
 * Field tables for the YearCompass-faithful steps. Each constant
 * maps 1:1 to a page in the official A4 booklet
 * (https://yearcompass.com/fr/) — see `documentation/Modules/Review.md`
 * for the canonical payload shape.
 */

/** Page 5 + 15 — eight life areas, exactly as the booklet lists
 *  them. Reused for both `last_year.life_areas` and
 *  `next_year.life_areas`. */
export const LIFE_AREAS_FIELDS: KeyLabel[] = [
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
export const SIX_PHRASES_LAST: KeyLabel[] = [
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
export const SIX_QUESTIONS: MixedKeyLabel[] = [
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
export const SUCCESSES_AND_CHALLENGES: MixedKeyLabel[] = [
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
export const CLOSING_LAST: MixedKeyLabel[] = [
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
export const TRIPLETS: KeyLabel[] = [
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
export const SIX_PHRASES_NEXT: KeyLabel[] = [
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
