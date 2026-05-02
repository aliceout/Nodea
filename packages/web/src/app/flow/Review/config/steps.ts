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
 * Architecture: types live in `step-types.ts`, the field tables in
 * `step-fields.ts`. This file owns the STEPS array, the group labels,
 * and the path-walk helpers used by the Wizard / Reader.
 */
import {
  CLOSING_LAST,
  LIFE_AREAS_FIELDS,
  SIX_PHRASES_LAST,
  SIX_PHRASES_NEXT,
  SIX_QUESTIONS,
  SUCCESSES_AND_CHALLENGES,
  TRIPLETS,
} from './step-fields.ts';
import type { Step, StepGroup } from './step-types.ts';

export type {
  BaseStep,
  IntroStep,
  KeyLabel,
  KeyedListStep,
  KeyedMixedStep,
  KeyedTextStep,
  MixedFieldType,
  MixedKeyLabel,
  Step,
  StepGroup,
  StepKind,
  StringListStep,
  TextareaStep,
} from './step-types.ts';

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
    group: 'lastYear',
    path: 'lastYear.agenda_review',
    kind: 'string_list',
    title: 'Consulte ton agenda',
    subtitle:
      "Reprends ton calendrier de l'année passée semaine par semaine. Si tu y remarques des événements importants (rassemblements familiaux, amicaux, projets significatifs), écris-les ci-dessous.",
    placeholder: 'Un événement, un voyage, une rencontre…',
  },
  {
    id: 'life_areas_last',
    group: 'lastYear',
    path: 'lastYear.life_areas',
    kind: 'keyed_list',
    title: "Voici ce qu'a été mon année passée",
    subtitle:
      "Réfléchis aux domaines décrits ci-dessous et demande-toi quels événements significatifs ont eu lieu dans chacun d'entre eux cette année.",
    fields: LIFE_AREAS_FIELDS,
  },
  {
    id: 'six_phrases_last',
    group: 'lastYear',
    path: 'lastYear.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases à propos de mon année précédente',
    fields: SIX_PHRASES_LAST,
  },
  {
    id: 'six_questions',
    group: 'lastYear',
    path: 'lastYear.six_questions',
    kind: 'keyed_mixed',
    title: 'Six questions à propos de mon année précédente',
    fields: SIX_QUESTIONS,
  },
  {
    id: 'best_moments',
    group: 'lastYear',
    path: 'lastYear.best_moments',
    kind: 'textarea',
    title: 'Les meilleurs moments',
    subtitle:
      "Décris les moments les plus beaux, les plus joyeux et les plus remarquables de l'année dernière. Qu'as-tu ressenti ? Avec qui étais-tu ? Qu'avez-vous fait ? Quels parfums, sons, saveurs te reviennent ?",
    placeholder: 'Un moment qui te revient…',
  },
  {
    id: 'successes_and_challenges',
    group: 'lastYear',
    path: 'lastYear.successes_and_challenges',
    kind: 'keyed_mixed',
    title: 'Mes trois plus grands succès et mes trois plus grands défis',
    fields: SUCCESSES_AND_CHALLENGES,
  },
  {
    id: 'forgiveness',
    group: 'lastYear',
    path: 'lastYear.forgiveness',
    kind: 'textarea',
    title: 'Pardonner',
    subtitle:
      "As-tu vécu des choses que tu n'as pas encore réussi à pardonner ? Des actes ou des mots qui t'ont blessé·e ? Es-tu en colère contre toi-même ? Tu peux le détailler ci-dessous. Permets-toi d'avancer et pardonne.",
    placeholder: 'Je pardonne à…',
    help: "Si tu penses ne pas être prêt·e à pardonner, écris-le quand même. Cela peut faire des miracles.",
  },
  {
    id: 'letting_go',
    group: 'lastYear',
    path: 'lastYear.letting_go',
    kind: 'textarea',
    title: 'Lâcher prise',
    subtitle:
      "Qu'as-tu d'autre à dire pour sceller l'année passée ? Sur quoi dois-tu lâcher prise avant de pouvoir commencer l'année qui vient ? Écris, fais le point, et lâche prise sur tous ces sujets.",
    placeholder: 'Je laisse partir…',
  },
  {
    id: 'closing_last',
    group: 'lastYear',
    path: 'lastYear.closing',
    kind: 'keyed_mixed',
    title: "Clôture de l'année écoulée",
    fields: CLOSING_LAST,
  },

  // ---- L'année devant toi ------------------------------------------
  {
    id: 'dream_big',
    group: 'nextYear',
    path: 'nextYear.dream_big',
    kind: 'textarea',
    title: 'Ose rêver en grand !',
    subtitle:
      "À quoi ressemble l'année prochaine ? Dans l'idéal, que va-t-il se passer ? Pourquoi ça va être génial ? Écris, oublie tes attentes et ose rêver.",
    placeholder: 'Je me vois…',
  },
  {
    id: 'life_areas_next',
    group: 'nextYear',
    path: 'nextYear.life_areas',
    kind: 'keyed_list',
    title: 'Cette nouvelle année ressemblera à ça pour moi',
    subtitle:
      "Réfléchis aux domaines de ta vie et décide des objectifs à atteindre dans chacun d'entre eux l'année prochaine. Notes-les ci-dessous — c'est le premier pas vers leur réalisation.",
    fields: LIFE_AREAS_FIELDS,
  },
  {
    id: 'triplets',
    group: 'nextYear',
    path: 'nextYear.triplets',
    kind: 'keyed_list',
    title: "Le triplet magique pour l'année à venir",
    subtitle: 'Trois choses par thème : ce qui guidera ton année.',
    fields: TRIPLETS,
  },
  {
    id: 'six_phrases_next',
    group: 'nextYear',
    path: 'nextYear.six_phrases',
    kind: 'keyed_text',
    title: 'Six phrases sur mon année à venir',
    fields: SIX_PHRASES_NEXT,
  },
  {
    id: 'word_of_year',
    group: 'nextYear',
    path: 'nextYear.word_of_year',
    kind: 'textarea',
    title: "Mon mot pour l'année prochaine",
    subtitle:
      "Choisis-toi un mot pour l'année prochaine. Il te donnera le pouvoir de ne pas abandonner tes rêves, et tu peux compter sur lui si tu as besoin d'un coup de pouce. Ce mot définit l'année à venir.",
    placeholder: 'Un mot…',
  },
  {
    id: 'secret_wish',
    group: 'nextYear',
    path: 'nextYear.secret_wish',
    kind: 'textarea',
    title: 'Souhait secret',
    subtitle:
      "Laisse libre cours à ton esprit. Quel est ton désir secret pour l'année à venir ?",
    placeholder: 'Mon vœu pour cette année…',
  },
];

export const GROUP_LABELS: Record<StepGroup, string> = {
  welcome: 'Bienvenue',
  lastYear: "L'année passée",
  nextYear: "L'année devant toi",
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
