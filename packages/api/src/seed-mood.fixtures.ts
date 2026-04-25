import type { MoodPayload } from '@nodea/shared';

/**
 * Mock Mood entries used by the `seed:mood` script. Hand-written so
 * the dataset reads like a real journal — varied positives, the full
 * −2..+2 score range, occasional comments and "question du jour"
 * answers, gaps where the user didn't write that day.
 *
 * Dates are computed relative to the moment the seed runs (`days(N)`
 * = N days before today, local TZ). Re-running the seed therefore
 * always produces a fresh "today" entry. The fixtures cover roughly
 * one rolling year so the GitHub-style frise has data for every
 * month it can render.
 */

function days(n: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - n);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

interface MoodFixture
  extends Pick<
    MoodPayload,
    | 'date'
    | 'mood_score'
    | 'positive1'
    | 'positive2'
    | 'positive3'
    | 'comment'
    | 'question'
    | 'answer'
  > {
  mood_emoji?: string;
}

export function buildMoodFixtures(): MoodFixture[] {
  return [
    // --- This week ----------------------------------------------------
    {
      date: days(0),
      mood_score: '2',
      positive1: 'Café tranquille avec Sam au matin.',
      positive2: 'Fin du chantier client envoyée, soulagement.',
      positive3: 'Longue marche au bord du canal.',
      comment: '',
      question: 'Quelle petite victoire peux-tu célébrer ?',
      answer: 'Avoir tenu une vraie pause sans ouvrir Slack.',
    },
    {
      date: days(1),
      mood_score: '-1',
      positive1: 'Réveil un peu plus doux que prévu.',
      positive2: 'Un message d’Élise qui faisait plaisir.',
      positive3: '',
      comment: 'Mauvais sommeil, tête lourde toute la matinée. Mieux après la pluie.',
    },
    {
      date: days(3),
      mood_score: '2',
      positive1: 'Anniversaire de Léa.',
      positive2: 'Dîner long avec rires multiples.',
      positive3: 'Riz brûlé, fou rire derrière.',
      comment: '',
    },
    {
      date: days(4),
      mood_score: '-1',
      positive1: 'Réussi à finir les notes du week-end.',
      positive2: '',
      positive3: '',
      comment: 'Reprise difficile. Trop de Slack, pas assez d’air.',
    },
    {
      date: days(5),
      mood_score: '1',
      positive1: 'Marché au matin, très calme.',
      positive2: 'Sieste posée.',
      positive3: 'Livre commencé puis abandonné, mais pas grave.',
      comment: '',
    },
    {
      date: days(6),
      mood_score: '1',
      positive1: 'Course longue dans le bois.',
      positive2: 'Découverte d’un sentier nouveau.',
      positive3: 'Genou un peu raide mais ça tient.',
      comment: '',
    },
    {
      date: days(7),
      mood_score: '0',
      positive1: 'Dîner annulé, finalement préféré rester chez moi.',
      positive2: 'Soirée lecture.',
      positive3: '',
      comment: '',
    },

    // --- 2 weeks ago --------------------------------------------------
    {
      date: days(10),
      mood_score: '2',
      positive1: 'Bon café au comptoir, sans téléphone.',
      positive2: 'Fini la lettre que je repoussais depuis 3 semaines.',
      positive3: 'Croisé deux amis par hasard.',
      comment: '',
    },
    {
      date: days(12),
      mood_score: '1',
      positive1: 'Réunion utile pour une fois.',
      positive2: 'Pause déjeuner au soleil.',
      positive3: '',
      comment: '',
    },
    {
      date: days(14),
      mood_score: '-2',
      positive1: '',
      positive2: '',
      positive3: '',
      comment: 'Grosse anxiété toute la matinée. La journée est longue.',
    },

    // --- 3-4 weeks ago ------------------------------------------------
    {
      date: days(18),
      mood_score: '1',
      positive1: 'Parlé longtemps avec maman.',
      positive2: 'Cours de cuisine improvisé avec L.',
      positive3: 'Premier vrai après-midi sans pluie.',
      comment: '',
    },
    {
      date: days(21),
      mood_score: '0',
      positive1: 'Tâches admin avalées d’un coup.',
      positive2: '',
      positive3: '',
      comment: '',
      question: 'Qu’est-ce qui t’a fait sourire aujourd’hui ?',
      answer: 'Le chien du voisin qui se prend pour un cheval.',
    },
    {
      date: days(24),
      mood_score: '2',
      positive1: 'Premier vrai pic de printemps.',
      positive2: 'Soirée jeux jusque tard.',
      positive3: 'Personne n’a triché.',
      comment: '',
    },
    {
      date: days(27),
      mood_score: '-1',
      positive1: 'Au moins j’ai écrit ces trois lignes.',
      positive2: '',
      positive3: '',
      comment: 'Journée un peu vide, sans accroche.',
    },

    // --- 5-8 weeks ago ------------------------------------------------
    {
      date: days(33),
      mood_score: '2',
      positive1: 'Reprise du sport après une longue pause.',
      positive2: 'Échange clair avec Marc, enfin.',
      positive3: 'Soir bien rangé, tête plus calme.',
      comment: '',
    },
    {
      date: days(40),
      mood_score: '0',
      positive1: 'Promenade au parc.',
      positive2: 'Petit-déjeuner long.',
      positive3: '',
      comment: '',
    },
    {
      date: days(48),
      mood_score: '-2',
      positive1: '',
      positive2: '',
      positive3: '',
      comment: 'Semaine très difficile. Pas grand-chose à sauver, mais je l’écris.',
    },
    {
      date: days(54),
      mood_score: '1',
      positive1: 'Concert avec C., très bon.',
      positive2: 'Marché bondé mais agréable.',
      positive3: '',
      comment: '',
    },

    // --- 2-4 months ago -----------------------------------------------
    {
      date: days(70),
      mood_score: '2',
      positive1: 'Première vraie balade en forêt.',
      positive2: 'Photo qui m’a plu pour une fois.',
      positive3: 'Bon livre fini.',
      comment: '',
    },
    {
      date: days(95),
      mood_score: '-1',
      positive1: 'Réussi à appeler le médecin.',
      positive2: '',
      positive3: '',
      comment: 'Tunnel d’hiver, comme tous les ans.',
    },
    {
      date: days(118),
      mood_score: '1',
      positive1: 'Dîner long avec mes parents, pour une fois sans heurts.',
      positive2: 'Reçu de bonnes nouvelles côté boulot.',
      positive3: '',
      comment: '',
    },

    // --- 5-10 months ago (often crosses the previous calendar year) --
    {
      date: days(150),
      mood_score: '0',
      positive1: 'Petite victoire admin.',
      positive2: 'Revu une vieille amie.',
      positive3: '',
      comment: '',
    },
    {
      date: days(195),
      mood_score: '2',
      positive1: 'Premier vrai jour de vacances.',
      positive2: 'Plage déserte au matin.',
      positive3: 'Le chat m’a accepté sur ses genoux.',
      comment: '',
    },
    {
      date: days(240),
      mood_score: '1',
      positive1: 'Bilan posé, sans drame.',
      positive2: 'Apéro avec L. et S.',
      positive3: 'Coucher tôt.',
      comment: '',
    },
    {
      date: days(310),
      mood_score: '-1',
      positive1: 'Au moins suis sortie marcher.',
      positive2: '',
      positive3: '',
      comment: 'Saison creuse, comme prévu.',
    },
    {
      date: days(355),
      mood_score: '2',
      positive1: 'Anniversaire de mariage de M. & N.',
      positive2: 'Discours improvisé qui a fait rire.',
      positive3: 'Pas de gueule de bois.',
      comment: '',
    },
  ];
}
