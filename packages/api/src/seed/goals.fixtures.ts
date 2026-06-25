import type { GoalsPayload } from '@nodea/shared';
import { daysAgo, monthsAgo, nowMinusDays } from './shared.ts';

/**
 * Hand-written Goals fixtures — small, varied, real-feeling.
 *
 * Coverage goals :
 *   - Three statuses (open / wip / done) so each filter chip has
 *     something to show.
 *   - At least two threads (« perso », « pro ») so the « par fil »
 *     grouping renders multiple buckets, plus one thread-less goal
 *     so the « — sans thread — » bucket is exercised.
 *   - Mix of `YYYY-MM` (intention dates) and bare `YYYY` (vague,
 *     « cette année ») so `formatDate` is exercised end-to-end.
 *   - One done goal carries `completedAt` so the « date de
 *     complétion » path is wired ; another stays null so we
 *     also test the « date inconnue » fallback.
 *   - Notes use the lightweight Markdown subset (`**bold**`,
 *     `- bullet`) so the new `MarkdownEditor` rendering on the
 *     Goals composer has something realistic to display.
 */

type GoalFixture = Pick<
  GoalsPayload,
  | 'date'
  | 'title'
  | 'note'
  | 'status'
  | 'thread'
  | 'completedAt'
  | 'updatedAt'
>;

export function buildGoalsFixtures(): GoalFixture[] {
  const thisYear = new Date().getFullYear();
  const yyyy = (offset = 0): string => String(thisYear + offset);

  return [
    {
      date: `${yyyy()}-12`,
      title: 'Lancer un blog technique',
      note:
        'Garder un rythme **mensuel** : un sujet par mois, pas plus.\n' +
        '- Choisir l’hébergement (Cloudflare ?)\n' +
        '- Premier post avant la fin du mois\n' +
        '- Mailing list opt-in à brancher plus tard',
      status: 'wip',
      thread: 'pro',
      completedAt: null,
      updatedAt: nowMinusDays(2),
    },
    {
      date: `${yyyy()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      title: 'Marcher 8 km par jour',
      note: 'Plutôt fin d’aprem qu’en pleine journée.',
      status: 'wip',
      thread: 'perso',
      completedAt: null,
      updatedAt: nowMinusDays(0),
    },
    {
      date: `${yyyy()}-09`,
      title: 'Finir le déménagement Lyon',
      note:
        'Cartons restants : cuisine + livres.\n' +
        '- Désinscrire de la box internet ancienne adresse\n' +
        '- Faire suivre courrier (3 mois)',
      status: 'done',
      thread: 'perso',
      completedAt: nowMinusDays(45),
      updatedAt: nowMinusDays(45),
    },
    {
      date: `${yyyy()}-06`,
      title: 'Rendre la mission client X',
      note:
        'Rendu propre, pas de retours bloquants. **Bilan : ne plus accepter ce type de scope sans cadrage écrit.**',
      status: 'done',
      thread: 'pro',
      completedAt: nowMinusDays(120),
      updatedAt: nowMinusDays(120),
    },
    {
      date: `${yyyy()}-${String(((new Date().getMonth() + 2) % 12) + 1).padStart(2, '0')}`,
      title: 'Rendre visite à mes parents (week-end long)',
      note: 'Trois jours suffisent. Train réservé tôt = -40 % sur le billet.',
      status: 'open',
      thread: 'perso',
      completedAt: null,
      updatedAt: nowMinusDays(7),
    },
    {
      date: yyyy(),
      title: 'Lire 24 livres cette année',
      note:
        '**Suivi** dans Library.\n' +
        '- Garder un mix fiction / non-fiction\n' +
        '- Pas de pression sur la longueur — un essai court compte',
      status: 'wip',
      thread: 'perso, lecture',
      completedAt: null,
      updatedAt: nowMinusDays(1),
    },
    {
      date: `${yyyy()}-${String(((new Date().getMonth() + 4) % 12) + 1).padStart(2, '0')}`,
      title: 'Refaire le CV + portfolio',
      note: 'Pas urgent. Bloquer un dimanche entier plutôt que grignoter en soirée.',
      status: 'open',
      thread: 'pro',
      completedAt: null,
      updatedAt: monthsAgo(2),
    },
    {
      date: `${yyyy(-1)}-${String(new Date().getMonth() + 1).padStart(2, '0')}`,
      title: 'Préparer le bilan YearCompass',
      note: 'Faire le carnet *avant* le 31 décembre, pas après. Bloquer une demi-journée.',
      status: 'done',
      thread: '',
      completedAt: null, // legacy : ce goal a été fini avant qu'on ait le timestamp
      updatedAt: monthsAgo(11),
    },
    {
      // Legacy goal that landed in the system without a precise
      // date — the Goals page tolerates `''` as « date manquante ».
      date: '',
      title: 'Reprendre la guitare',
      note: 'Posée depuis trois ans. Voir si je veux vraiment, ou si c’est juste de la nostalgie.',
      status: 'open',
      thread: 'perso',
      completedAt: null,
      updatedAt: daysAgo(60),
    },
  ];
}
