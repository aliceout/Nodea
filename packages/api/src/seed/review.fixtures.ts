import type { ReviewPayload } from '@nodea/shared';
import { monthsAgo } from './shared.ts';

/**
 * One YearCompass review fixture for last year, partially filled.
 *
 * « Quality > quantity » — the goal isn't to populate every one of
 * the 15 question steps but to exercise each `kind` of step at
 * least once :
 *   - `string_list` (agenda_review, best_moments, three_words…)
 *   - `keyed_list` (life_areas, triplets)
 *   - `keyed_text` (six_phrases_last, six_phrases_next)
 *   - `keyed_mixed` (six_questions, successes_and_challenges,
 *     closing_last)
 *   - `textarea` (forgiveness, letting_go, dream_big, secret_wish,
 *     word_of_year, best_moments)
 *
 * A second « half-empty » review for the year before last surfaces
 * the « bilan partiel » feel of the reader's empty-section
 * filtering — anything not filled is hidden in the reader.
 *
 * See `documentation/Modules/Review.md` for the canonical payload
 * shape and the YearCompass page mapping.
 */

export function buildReviewFixtures(): ReviewPayload[] {
  const thisYear = new Date().getFullYear();
  const lastYear = thisYear - 1;
  const yearBeforeLast = thisYear - 2;

  return [
    {
      year: lastYear,
      lastYear: {
        agenda_review: [
          'Janvier — déménagement Lyon',
          'Mars — départ mission longue, soulagement',
          'Mai — voyage Lisbonne avec Eva',
          'Septembre — début de la thérapie',
          'Décembre — reprise de la guitare (sans pression)',
        ],
        life_areas: {
          personal_family: ['Plus proche de ma sœur', 'Visites parents régulières'],
          career_studies: ['Mission longue terminée', 'Premier projet en solo'],
          friends_community: [
            'Voyage avec Eva — ça a recréé du lien',
            'Brunch mensuel relancé',
          ],
          leisure_creativity: [
            'Atelier écriture suivi 3 mois',
            'Reprise de la guitare en décembre',
          ],
          physical_health: ['Marche quotidienne installée', '8 km/jour en moyenne'],
          mental_health: ['Démarrage thérapie — soulagement immédiat'],
          habits: ['Lecture du soir tenue, presque tous les jours'],
          better_world: [
            'Bénévolat associatif tous les 15 jours — petite chose mais régulière',
          ],
        },
        six_phrases: {
          wisest_decision: 'Refuser le contrat client Y malgré le tarif.',
          biggest_lesson:
            'Mon rythme naturel n’est pas un défaut à corriger, c’est une donnée.',
          biggest_risk: 'Démarrer la thérapie après dix ans à l’éviter.',
          biggest_surprise: 'Se sentir aussi bien à Lyon dès le premier mois.',
          service_rendered:
            'Aidé Marc à reformuler sa lettre de démission — il pleurait, il est parti debout.',
          biggest_accomplishment: 'Tenu la mission longue jusqu’au bout sans burn-out.',
        },
        six_questions: {
          proud_of: 'D’avoir dit non à la mission Y sans me justifier pendant 30 minutes.',
          influenced_by: ['Eva', 'Mon thérapeute', 'Cal Newport'],
          influenced: ['Marc', 'Anouk', 'Sam'],
          not_realized: 'Apprendre l’espagnol — toujours « plus tard ».',
          best_self_discovery:
            'Je peux passer une journée entière en silence et c’est *reposant*, pas anxiogène.',
          gratitude: 'D’avoir une sœur à qui je peux téléphoner sans raison.',
        },
        best_moments:
          'La soirée plage à Lisbonne avec Eva, le 14 mai. *Aucun téléphone, juste le bruit du Tage.* C’est de ce moment que je me souviendrai dans dix ans.',
        successes_and_challenges: {
          three_successes: [
            'Tenu la mission longue',
            'Démarré la thérapie',
            'Refusé deux contrats mal cadrés',
          ],
          successes_how:
            'En arrêtant d’essayer d’aller plus vite, en parlant plus avec Eva et ma sœur, en tenant un journal du soir.',
          three_challenges: [
            'Le burnout léger de mai',
            'Les disputes avec maman en juin',
            'Le pic d’anxiété d’octobre',
          ],
          challenges_how:
            'Les amis proches qui n’ont rien dramatisé. La thérapie qui était déjà commencée. Et — surtout — accepter de **ne rien faire** pendant trois jours après le pic.',
        },
        forgiveness:
          'Je pardonne à mon père de ne pas avoir su parler quand j’avais 16 ans. Je sais maintenant qu’il ne savait pas comment.',
        letting_go:
          'Je laisse partir l’idée que je dois prouver que je suis sérieux·se. *Personne ne demande, sauf moi.*',
        closing: {
          three_words: ['fatigue', 'apprentissage', 'amour'],
          book_title:
            'Le long chemin du non — comment j’ai arrêté de m’expliquer',
          farewell:
            'Au revoir 2025. Merci pour les voyages, les longues marches, et la liste des choses que je ne ferai plus.',
        },
      },
      nextYear: {
        dream_big:
          'Je me vois écrivant une heure chaque matin avant de regarder un écran. Une *vraie heure*, pas dix minutes grappillées. Je me vois avec un projet d’écriture qui dure six mois et qui finit. Je me vois avec deux ou trois soirées par semaine sans rien — vraiment rien.',
        life_areas: {
          personal_family: ['Appeler ma sœur tous les dimanches'],
          career_studies: [
            'Un seul projet client à la fois',
            'Un projet perso d’écriture en parallèle',
          ],
          friends_community: ['Le brunch mensuel reste sacré', 'Inviter à dîner 1×/mois'],
          leisure_creativity: [
            'Continuer la guitare — un morceau par mois',
            'Atelier d’écriture jusqu’en juin',
          ],
          physical_health: ['Marche quotidienne maintenue'],
          mental_health: ['Thérapie continuée'],
          habits: ['Heure d’écriture matinale'],
          better_world: ['Bénévolat passé à hebdomadaire'],
        },
        triplets: {
          self_love: ['Mes mains', 'Ma lenteur', 'Mon goût pour le silence'],
          let_go: [
            'L’idée d’une carrière linéaire',
            'Le besoin d’être validé·e par les anciens',
            'Le scrolling du dimanche soir',
          ],
          main_goals: [
            'Sortir un projet d’écriture',
            'Tenir 12 mois de thérapie',
            'Pas de burn-out',
          ],
          support: ['Eva', 'Ma sœur', 'Mon thérapeute'],
          discover: [
            'L’écriture longue (4-6 mois)',
            'Le yoga (vraiment, cette fois)',
            'Une nouvelle ville en France pour 5 jours',
          ],
          say_no: [
            'Aux contrats mal cadrés',
            'Aux dîners pros le jeudi soir',
            'Aux notifications après 20 h',
          ],
          environment: [
            'Bureau rangé tous les vendredis',
            'Une plante de plus dans le salon',
            'Un seul écran, pas deux',
          ],
          morning_routines: [
            'Une heure d’écriture',
            'Pas de téléphone avant 9 h',
            'Marche de 20 min',
          ],
          self_care: [
            'Massage tous les deux mois',
            'Une journée 100 % seul·e par mois',
            'Coucher avant 23 h',
          ],
          places: ['Naples', 'Granada', 'L’île de Sein'],
          get_closer: [
            'Appeler maman une fois par semaine',
            'Voir Anouk en vrai au moins une fois par trimestre',
            'Écrire à mon vieux pote Marc',
          ],
          rewards: [
            'Un week-end seul·e dans un Airbnb après le projet d’écriture',
            'Une bonne paire de chaussures de marche',
            'Un disque vinyle par trimestre',
          ],
        },
        six_phrases: {
          no_procrastination: 'écrire le matin avant de regarder un écran.',
          energy_source: 'des longues marches sans téléphone.',
          courage:
            'lorsqu’il faudra dire non à la première opportunité « trop bonne pour refuser ».',
          positive_answer: 'lorsqu’on me proposera de prendre du temps pour moi.',
          advice: 'ne pas confondre vitesse et avancement.',
          special_because:
            'je veux la finir avec un projet long achevé, pas dix projets courts à moitié.',
        },
        word_of_year: 'ancrage',
        secret_wish:
          'Recevoir une lettre acceptant un texte dans une revue. Même petite. Juste une.',
      },
      updatedAt: monthsAgo(1),
    },
    {
      // Bilan partiel de l'année antérieure — exercise des sections vides.
      year: yearBeforeLast,
      lastYear: {
        agenda_review: [
          'Quitter Paris',
          'Premier mois en province, surprise',
        ],
        best_moments:
          'Le matin où j’ai posé la dernière boîte du déménagement et bu mon café sur le balcon vide.',
        forgiveness: 'Je pardonne à mon ancien manageur — il faisait ce qu’il pouvait.',
        closing: {
          three_words: ['rupture', 'soulagement', 'inconnu'],
          book_title: 'Partir',
          farewell: 'Au revoir Paris. C’était le bon moment.',
        },
      },
      nextYear: {
        word_of_year: 'commencer',
      },
      updatedAt: monthsAgo(13),
    },
  ];
}
